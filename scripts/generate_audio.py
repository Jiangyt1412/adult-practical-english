#!/usr/bin/env python3
"""Generate and quality-check all local Lesson 1 audio files."""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import edge_tts


VOICES = {
    "ryan": "en-GB-RyanNeural",
    "sonia": "en-GB-SoniaNeural",
}
TARGET_SAMPLE_RATE = 24_000
TARGET_CHANNELS = 1
TARGET_SAMPLE_WIDTH = 2
TARGET_PEAK_DBFS = -1.1


def project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_items(root: Path) -> list[dict]:
    source = (root / "data" / "lessons.js").read_text(encoding="utf-8")
    prefix = "window.ADULT_ENGLISH_LESSONS = "
    if not source.startswith(prefix) or not source.rstrip().endswith(";"):
        raise RuntimeError("data/lessons.js is not in the expected JSON-compatible format")
    payload = json.loads(source[len(prefix):].rstrip()[:-1])
    lesson = next(item for item in payload["lessons"] if item["id"] == "lesson-01")
    return [item for section in lesson["sections"] for item in section["items"]]


def find_ffmpeg() -> str:
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError) as exc:
        raise RuntimeError("ffmpeg was not found; install ffmpeg or imageio-ffmpeg") from exc


def learner_text(text: str) -> str:
    return text.replace("; ", ". ... ")


async def synthesize(text: str, voice: str, output: Path) -> None:
    rate = "-6%" if ";" in text else "+0%"
    communicate = edge_tts.Communicate(learner_text(text), voice, rate=rate)
    await communicate.save(str(output))


def run_ffmpeg(ffmpeg: str, source: Path, output: Path, volume: float = 1.0) -> None:
    filters = ["afade=t=in:st=0:d=0.005", "areverse", "afade=t=in:st=0:d=0.005", "areverse"]
    if volume < 0.9999:
        filters.append(f"volume={volume:.8f}")
    command = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-af", ",".join(filters), "-ac", str(TARGET_CHANNELS), "-ar", str(TARGET_SAMPLE_RATE),
        "-c:a", "pcm_s16le", str(output),
    ]
    subprocess.run(command, check=True)


def read_pcm(path: Path) -> tuple[wave._wave_params, tuple[int, ...]]:
    with wave.open(str(path), "rb") as wav_file:
        params = wav_file.getparams()
        frames = wav_file.readframes(params.nframes)
    if params.sampwidth != 2:
        return params, tuple()
    samples = struct.unpack(f"<{len(frames) // 2}h", frames)
    return params, samples


def peak_dbfs(samples: tuple[int, ...]) -> float:
    if not samples:
        return float("-inf")
    peak = max(abs(value) for value in samples)
    return 20 * math.log10(peak / 32768) if peak else float("-inf")


def enforce_peak(ffmpeg: str, path: Path) -> None:
    _, samples = read_pcm(path)
    measured = peak_dbfs(samples)
    if measured <= TARGET_PEAK_DBFS:
        return
    gain = 10 ** ((TARGET_PEAK_DBFS - measured) / 20)
    adjusted = path.with_suffix(".adjusted.wav")
    run_ffmpeg(ffmpeg, path, adjusted, volume=gain)
    adjusted.replace(path)


def inspect(path: Path, voice_key: str, voice_name: str) -> dict:
    params, samples = read_pcm(path)
    peak = peak_dbfs(samples)
    clipping = any(abs(value) >= 32767 for value in samples)
    maximum_delta = max((abs(right - left) for left, right in zip(samples, samples[1:])), default=0)
    transient = maximum_delta > 31_000
    passed = (
        params.framerate == TARGET_SAMPLE_RATE
        and params.nchannels == TARGET_CHANNELS
        and params.sampwidth == TARGET_SAMPLE_WIDTH
        and peak <= -1.0
        and not clipping
        and not transient
    )
    return {
        "filename": path.name,
        "relative_path": path.relative_to(project_root()).as_posix(),
        "voice": voice_key,
        "voice_name": voice_name,
        "sample_rate": params.framerate,
        "bit_depth": params.sampwidth * 8,
        "channels": params.nchannels,
        "duration_seconds": round(params.nframes / params.framerate, 3),
        "peak_dbfs": round(peak, 2) if math.isfinite(peak) else None,
        "clipping_detected": clipping,
        "abnormal_transient_detected": transient,
        "qc_passed": passed,
    }


def write_reports(root: Path, records: list[dict]) -> None:
    summary = {
        "total_files": len(records),
        "ryan_files": sum(item["voice"] == "ryan" for item in records),
        "sonia_files": sum(item["voice"] == "sonia" for item in records),
        "all_qc_passed": all(item["qc_passed"] for item in records),
    }
    report = {"specification": {"sample_rate": 24000, "bit_depth": 16, "channels": 1, "peak_limit_dbfs": -1.0}, "summary": summary, "files": records}
    (root / "audio_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rows = [
        "# Audio QC Report",
        "",
        f"- Total WAV files: {summary['total_files']}",
        f"- Ryan: {summary['ryan_files']}",
        f"- Sonia: {summary['sonia_files']}",
        f"- All QC passed: {'Yes' if summary['all_qc_passed'] else 'No'}",
        "- Master format: WAV, 24,000 Hz, 16-bit PCM, mono",
        "- Peak limit: -1.0 dBFS",
        "",
        "| File | Voice | Rate | Bits | Channels | Peak dBFS | Clipping | Transient | QC |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for item in records:
        rows.append(
            f"| `{item['filename']}` | {item['voice'].title()} | {item['sample_rate']} | {item['bit_depth']} | "
            f"{item['channels']} | {item['peak_dbfs']} | {'Yes' if item['clipping_detected'] else 'No'} | "
            f"{'Yes' if item['abnormal_transient_detected'] else 'No'} | {'Pass' if item['qc_passed'] else 'Fail'} |"
        )
    (root / "docs" / "AUDIO_REPORT.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


async def generate(force: bool) -> int:
    root = project_root()
    items = load_items(root)
    ffmpeg = find_ffmpeg()
    records: list[dict] = []

    with tempfile.TemporaryDirectory(prefix="adult-english-audio-") as temp_dir:
        temp = Path(temp_dir)
        for voice_key, voice_name in VOICES.items():
            destination = root / "assets" / "audio" / "lesson-01" / voice_key
            destination.mkdir(parents=True, exist_ok=True)
            for index, item in enumerate(items, start=1):
                wav_path = destination / f"{item['id']}.wav"
                if force or not wav_path.exists():
                    mp3_path = temp / f"{voice_key}-{item['id']}.mp3"
                    print(f"[{voice_key} {index:02d}/{len(items)}] {item['id']}")
                    await synthesize(item["speech"], voice_name, mp3_path)
                    run_ffmpeg(ffmpeg, mp3_path, wav_path)
                    enforce_peak(ffmpeg, wav_path)
                records.append(inspect(wav_path, voice_key, voice_name))

    records.sort(key=lambda item: (item["voice"], item["filename"]))
    write_reports(root, records)
    failures = [item for item in records if not item["qc_passed"]]
    if failures:
        print(f"QC failed for {len(failures)} file(s).", file=sys.stderr)
        return 1
    print(f"QC passed for all {len(records)} WAV files.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Regenerate audio files that already exist")
    args = parser.parse_args()
    return asyncio.run(generate(args.force))


if __name__ == "__main__":
    raise SystemExit(main())
