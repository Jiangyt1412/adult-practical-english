# Adult Practical English Review

## 中文简介

这是一个面向成人英语口语课程的课后复习网站。学生可以按课程查看单词、短语和英式音标，分别收听 Ryan 与 Sonia 两种英式英语发音，并通过“已练习”进度和浏览器内录音进行跟读练习。

项目采用纯 HTML、CSS 和 Vanilla JavaScript，不需要登录、数据库或后端服务。正式音频均为预先生成并通过质量检查的本地 WAV 文件，网页打开后不会调用在线 TTS 接口，适合通过 GitHub Pages 等静态托管服务部署。

### 主要功能

- 移动端优先，兼容手机和桌面浏览器
- Ryan 与 Sonia 两套英式英语本地音频
- 单词、短语、IPA 与重点辨音练习
- 使用浏览器本地存储保存练习进度
- 支持在浏览器中录音和回放，不上传录音
- 支持 PWA，已播放音频可按浏览器能力缓存

A mobile-first, static review site for an adult spoken-English course. Lesson 1 is designed for a short cycle: read the word or phrase, listen to either UK voice, and repeat.

The site uses plain HTML, CSS, and JavaScript. It has no backend, account system, database, runtime TTS call, third-party CDN, or build step.

## Project structure

```text
adult-practical-english/
├── index.html
├── lesson-01.html
├── styles.css
├── app.js
├── manifest.json
├── sw.js
├── audio_report.json
├── data/
│   └── lessons.js
├── assets/
│   ├── icons/
│   └── audio/lesson-01/
│       ├── ryan/
│       └── sonia/
├── scripts/
│   ├── generate_audio.py
│   └── requirements.txt
└── docs/
    └── AUDIO_REPORT.md
```

## Preview locally

Opening `index.html` directly works for the main pages, audio, and progress tracking. A local web server is recommended because service workers and microphone access require a secure web context or `localhost`.

```bash
python3 -m http.server 8000
# Open http://localhost:8000/ in Safari, Chrome, or Edge.
```

## Generate the audio

The committed WAV files are the website's master audio. The generator uses Microsoft `en-GB-RyanNeural` and `en-GB-SoniaNeural` through `edge-tts`, then converts and checks every file locally.

Requirements:

- Python 3.10 or later
- `edge-tts`
- `ffmpeg`, or the `imageio-ffmpeg` fallback in `requirements.txt`

macOS example:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/requirements.txt
# Optional if you prefer a system ffmpeg: brew install ffmpeg
python scripts/generate_audio.py --force
```

Without `--force`, existing WAV files are verified and missing files are generated. The script creates `audio_report.json` and `docs/AUDIO_REPORT.md`, and exits with an error if any file fails format, peak, clipping, or transient checks.

## Verify the audio

Run:

```bash
python scripts/generate_audio.py
```

Then confirm the summary says 74 files, 37 Ryan files, 37 Sonia files, and `All QC passed: Yes`. The target format is WAV, 24,000 Hz, 16-bit PCM, mono, with a peak no higher than -1 dBFS.

## Deploy to GitHub Pages

GitHub Pages is suitable as an overseas or test address. It does not guarantee stable access from mainland China.

1. Create a GitHub repository.
2. Upload the entire project so that `index.html` is in the repository root.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/(root)` folder.
6. Select **Save** and wait for the Pages deployment to finish.

All site URLs are relative, so a project URL such as `username.github.io/repository-name/` works without code changes. See GitHub's official guide: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>

## Mainland China deployment

Keep GitHub as the source and version-control repository. For student-facing access in mainland China, deploy the same static files separately to Tencent Cloud CloudBase Static Website Hosting. Do not maintain a different code version.

Console upload:

1. Sign in to Tencent Cloud, complete real-name verification, and create a CloudBase environment.
2. Open **CloudBase → Static Website Hosting**.
3. Choose **File Management**, then **Upload Folder**.
4. Upload the project folder contents, preserving the existing directory structure and keeping `index.html` at the hosted root.
5. Confirm the default home document is `index.html`, then test the assigned address.

CLI alternative:

```bash
npm install -g @cloudbase/cli
tcb login
tcb hosting deploy . -e YOUR_ENVIRONMENT_ID
```

CloudBase documentation: <https://docs.cloudbase.net/hosting/quick-start>

CloudBase's default domain is intended for development and testing. A formal mainland-China custom domain is subject to current ICP filing and provider requirements; verify the current rules before launch.

Deployment roles:

- GitHub: source and version control
- CloudBase: student-facing static deployment

The website does not use the GitHub API at runtime.

## Add Lesson 2

1. Add a new lesson object in `data/lessons.js`; the homepage creates its card automatically.
2. Copy `lesson-01.html` to `lesson-02.html`, then change `data-lesson="lesson-01"` to `data-lesson="lesson-02"` and update the page title and description.
3. Create `assets/audio/lesson-02/ryan/` and `assets/audio/lesson-02/sonia/`.
4. Extend `scripts/generate_audio.py` to select the new lesson, or generalise the lesson selector before generating its audio.
5. Add `lesson-02.html` to `APP_SHELL` in `sw.js` and increment `CACHE_NAME` so returning students receive the update.
6. Test every audio path and practise toggle before deployment.

## Browser notes

- Audio never autoplays and uses `preload="none"`.
- Starting another voice stops the current audio first.
- Practised state is stored locally in the browser.
- Recordings stay in the current browser session and are never uploaded.
- If an embedded browser blocks microphone access, open the page in Safari or Chrome.
- The service worker caches the app shell and audio requested without range headers; it does not preload the complete audio library.
