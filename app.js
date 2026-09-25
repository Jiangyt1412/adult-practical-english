(function () {
  "use strict";

  const catalog = window.ADULT_ENGLISH_LESSONS;
  if (!catalog || !Array.isArray(catalog.lessons)) return;

  registerServiceWorker();

  if (document.body.dataset.page === "home") renderHome();
  if (document.body.dataset.page === "lesson") renderLesson();

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function () {});
      });
    }
  }

  function renderHome() {
    const list = document.getElementById("lesson-list");
    catalog.lessons.forEach(function (lesson) {
      const card = document.createElement("article");
      card.className = "lesson-card";

      const copy = document.createElement("div");
      const number = document.createElement("p");
      number.className = "lesson-number";
      number.textContent = lesson.number;
      const title = document.createElement("h2");
      title.textContent = lesson.title;
      copy.append(number, title);

      const link = document.createElement("a");
      link.className = "start-link";
      link.href = "./" + lesson.page;
      link.textContent = "Start Review";
      card.append(copy, link);
      list.append(card);
    });
  }

  function renderLesson() {
    const lessonId = document.body.dataset.lesson;
    const lesson = catalog.lessons.find(function (entry) { return entry.id === lessonId; });
    if (!lesson) return;

    const heading = document.getElementById("lesson-heading");
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = lesson.eyebrow;
    const title = document.createElement("h1");
    title.textContent = lesson.number;
    const subtitle = document.createElement("p");
    subtitle.className = "lesson-subtitle";
    subtitle.textContent = lesson.title;
    heading.append(eyebrow, title, subtitle);
    if (lesson.instructions) {
      const instructions = document.createElement("p");
      instructions.className = "lesson-instructions";
      instructions.textContent = lesson.instructions;
      heading.append(instructions);
    }

    const content = document.getElementById("lesson-content");
    lesson.sections.forEach(function (section, sectionIndex) {
      const wrapper = document.createElement("section");
      wrapper.className = "lesson-section";
      const sectionTitle = document.createElement("h2");
      sectionTitle.textContent = "Section " + (sectionIndex + 1) + " · " + section.title;
      const cards = document.createElement("div");
      cards.className = "cards";
      section.items.forEach(function (item) { cards.append(createPracticeCard(lesson, item)); });
      wrapper.append(sectionTitle, cards);
      content.append(wrapper);
    });

    setupProgress(lesson);
    setupAudio();
    setupRecording();
  }

  function createPracticeCard(lesson, item) {
    const card = document.createElement("article");
    card.className = "practice-card";
    card.dataset.itemId = item.id;

    if (item.lead) {
      const lead = document.createElement("p");
      lead.className = "lead";
      lead.textContent = item.lead;
      card.append(lead);
    }

    const terms = document.createElement("div");
    terms.className = "terms";
    if (item.terms.length > 1) terms.classList.add("has-multiple");
    if (item.terms.length === 3) terms.classList.add("has-three");
    item.terms.forEach(function (term) {
      const termBlock = document.createElement("div");
      termBlock.className = "term";
      const word = document.createElement("span");
      word.className = "word";
      word.textContent = term.text;
      const ipa = document.createElement("span");
      ipa.className = "ipa";
      ipa.textContent = term.ipa;
      termBlock.append(word, ipa);
      terms.append(termBlock);
    });
    card.append(terms);

    if (item.phoneme || item.meaning) {
      const details = document.createElement("dl");
      details.className = "word-details";
      if (item.phoneme) appendDetail(details, "目标音标", item.phoneme);
      if (item.meaning) appendDetail(details, "中文意思", item.meaning);
      card.append(details);
    }

    if (item.contrast) {
      const contrast = document.createElement("span");
      contrast.className = "contrast";
      contrast.textContent = item.contrast;
      card.append(contrast);
    }
    if (item.tag) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item.tag;
      card.append(tag);
    }

    const actions = document.createElement("div");
    actions.className = "card-actions";
    ["ryan", "sonia"].forEach(function (voice) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "audio-button";
      button.dataset.audio = "./assets/audio/" + lesson.id + "/" + voice + "/" + item.id + ".wav";
      button.dataset.voice = voice;
      button.textContent = "▶ " + capitalize(voice);
      actions.append(button);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "practice-toggle";
    toggle.dataset.practiceId = item.id;
    toggle.setAttribute("aria-pressed", "false");
    toggle.textContent = "✓ Practised";
    actions.append(toggle);
    card.append(actions);
    return card;
  }

  function appendDetail(list, label, value) {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    group.append(term, description);
    list.append(group);
  }

  function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

  function setupProgress(lesson) {
    const storageKey = "adult-english:" + lesson.id + ":practised";
    const allItems = lesson.sections.flatMap(function (section) { return section.items; });
    let practised = readStoredSet(storageKey);
    const buttons = Array.from(document.querySelectorAll(".practice-toggle"));

    function draw() {
      buttons.forEach(function (button) {
        const active = practised.has(button.dataset.practiceId);
        button.setAttribute("aria-pressed", String(active));
        button.closest(".practice-card").classList.toggle("is-practised", active);
      });
      const count = practised.size;
      document.getElementById("progress-count").textContent = count + " / " + allItems.length;
      document.getElementById("progress-bar").style.width = ((count / allItems.length) * 100) + "%";
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.dataset.practiceId;
        if (practised.has(id)) practised.delete(id); else practised.add(id);
        try { localStorage.setItem(storageKey, JSON.stringify(Array.from(practised))); } catch (error) {}
        draw();
      });
    });
    draw();
  }

  function readStoredSet(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch (error) {
      return new Set();
    }
  }

  function setupAudio() {
    const audio = document.getElementById("lesson-audio");
    const buttons = Array.from(document.querySelectorAll(".audio-button"));
    let currentButton = null;

    function resetButton() {
      if (!currentButton) return;
      currentButton.classList.remove("is-playing");
      currentButton.textContent = "▶ " + capitalize(currentButton.dataset.voice);
      currentButton = null;
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        if (currentButton === button && !audio.paused) {
          audio.pause();
          audio.currentTime = 0;
          resetButton();
          return;
        }
        audio.pause();
        audio.currentTime = 0;
        resetButton();
        currentButton = button;
        button.classList.add("is-playing");
        button.textContent = "■ " + capitalize(button.dataset.voice);
        audio.src = button.dataset.audio;
        audio.play().catch(function () { resetButton(); });
      });
    });
    audio.addEventListener("ended", resetButton);
    audio.addEventListener("error", resetButton);
  }

  function setupRecording() {
    const recordButton = document.getElementById("record-button");
    const playButton = document.getElementById("play-recording");
    const status = document.getElementById("recording-status");
    let recorder = null;
    let stream = null;
    let chunks = [];
    let recordingUrl = null;
    let recordedAudio = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      recordButton.disabled = true;
      status.textContent = "Please open in Safari or Chrome to use recording.";
      return;
    }

    recordButton.addEventListener("click", async function () {
      if (recorder && recorder.state === "recording") {
        recorder.stop();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.addEventListener("dataavailable", function (event) {
          if (event.data.size > 0) chunks.push(event.data);
        });
        recorder.addEventListener("stop", function () {
          if (recordingUrl) URL.revokeObjectURL(recordingUrl);
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          recordingUrl = URL.createObjectURL(blob);
          recordedAudio = new Audio(recordingUrl);
          playButton.disabled = false;
          recordButton.classList.remove("is-recording");
          recordButton.textContent = "Record yourself";
          status.textContent = "Recording ready.";
          stream.getTracks().forEach(function (track) { track.stop(); });
        });
        recorder.start();
        recordButton.classList.add("is-recording");
        recordButton.textContent = "Stop recording";
        status.textContent = "Recording…";
      } catch (error) {
        status.textContent = "Please open in Safari or Chrome to use recording.";
      }
    });

    playButton.addEventListener("click", function () {
      if (!recordedAudio) return;
      recordedAudio.currentTime = 0;
      recordedAudio.play().catch(function () {
        status.textContent = "Unable to play this recording.";
      });
    });
  }
}());
