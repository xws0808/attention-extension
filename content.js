console.log("Focus Coach: content script loaded");

let watchStartTime = null;
let currentVideoId = null;
let ringInterval = null;
let currentElapsedSeconds = 0;
let nudgeActive = false;
let pendingRate = null;
let nudgeTimeout = null;
let programmaticChange = false;
let pendingNavigationUrl = null;
let targetCelebrated = false;

let TARGET_SECONDS = 60;

function getVideoIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

function findVideoElement() {
  return document.querySelector("video");
}

function setPlaybackRate(video, rate) {
  programmaticChange = true;
  video.playbackRate = rate;
}

async function isSnoozed() {
  const result = await chrome.storage.local.get(["snooze"]);
  const snooze = result.snooze;
  return snooze && snooze.until && snooze.until > Date.now();
}

function disableAutoplay() {
  const toggle = document.querySelector(".ytp-autonav-toggle-button");

  if (!toggle) {
    setTimeout(disableAutoplay, 1000);
    return;
  }

  const isOn = toggle.getAttribute("aria-checked") === "true";

  if (isOn) {
    toggle.click();
    console.log("Focus Coach: disabled YouTube's native autoplay");
  } else {
    console.log("Focus Coach: autoplay already off");
  }
}

function createOverlay() {
  if (document.getElementById("focus-coach-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "focus-coach-overlay";
  overlay.innerHTML = `
    <div id="fc-ring-view" style="display:flex; flex-direction:column; align-items:center;">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" class="fc-ring-bg" />
        <circle cx="24" cy="24" r="20" class="fc-ring-progress" id="fc-ring-progress" />
      </svg>
      <div id="fc-time-label">0:00</div>
    </div>
    <div id="fc-goat-view">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="#122016" stroke="#22c55e" stroke-width="4"/>
        <path d="M17 17 Q14 13 16 10 Q19 13 19 17 Z" fill="#dcdcd2"/>
        <path d="M31 17 Q34 13 32 10 Q29 13 29 17 Z" fill="#dcdcd2"/>
        <ellipse cx="24" cy="24" rx="10" ry="9" fill="#f2f2ea"/>
        <path d="M14 21 Q10 24 13 28 Q15 25 15.5 22 Z" fill="#dcdcd2"/>
        <path d="M34 21 Q38 24 35 28 Q33 25 32.5 22 Z" fill="#dcdcd2"/>
        <circle cx="20" cy="23" r="1.5" fill="#2c2c2a"/>
        <circle cx="28" cy="23" r="1.5" fill="#2c2c2a"/>
        <path d="M22 28 Q24 29.5 26 28" stroke="#b0b0a6" stroke-width="1.3" fill="none" stroke-linecap="round"/>
        <path d="M23 31 L22 34.5 Q24 36 26 34.5 L25 31 Z" fill="#dcdcd2"/>
      </svg>
      <div id="fc-goat-label">GOAT!</div>
    </div>
  `;
  document.body.appendChild(overlay);
  console.log("Focus Coach: overlay created");
}

function createNudge() {
  if (document.getElementById("focus-coach-nudge")) return;

  const nudge = document.createElement("div");
  nudge.id = "focus-coach-nudge";
  nudge.style.display = "none";
  nudge.innerHTML = `
    <span id="fc-nudge-text"></span>
    <button id="fc-nudge-confirm">Continue anyway</button>
  `;
  document.body.appendChild(nudge);

  document.getElementById("fc-nudge-confirm").addEventListener("click", () => {
    confirmNudge();
  });
}

function updateRing(elapsedSeconds) {
  currentElapsedSeconds = elapsedSeconds;

  const progressCircle = document.getElementById("fc-ring-progress");
  const label = document.getElementById("fc-time-label");
  if (!progressCircle || !label) return;

  const circumference = 2 * Math.PI * 20;
  const progress = Math.min(elapsedSeconds / TARGET_SECONDS, 1);
  const offset = circumference - progress * circumference;

  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = offset;

  if (elapsedSeconds >= TARGET_SECONDS) {
    progressCircle.classList.add("fc-complete");
    triggerGoatCelebration();
  } else {
    progressCircle.classList.remove("fc-complete");
  }

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  label.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
}

function triggerGoatCelebration() {
  if (targetCelebrated) return;
  targetCelebrated = true;

  const ringView = document.getElementById("fc-ring-view");
  const goatView = document.getElementById("fc-goat-view");
  if (!ringView || !goatView) return;

  ringView.style.display = "none";
  goatView.style.display = "flex";

  setTimeout(() => {
    goatView.style.display = "none";
    ringView.style.display = "flex";
  }, 2500);
}

function showNudge(secondsRemaining, requestedRate, video) {
  nudgeActive = true;
  pendingRate = requestedRate;
  console.log("Focus Coach: showNudge called, pendingRate set to:", pendingRate);

  const nudge = document.getElementById("focus-coach-nudge");
  const text = document.getElementById("fc-nudge-text");
  text.textContent = `${secondsRemaining}s from your target, hang in there`;
  nudge.style.display = "flex";

  nudgeTimeout = setTimeout(() => {
    console.log("Focus Coach: timeout fired, attempting to set rate to:", pendingRate);
    setPlaybackRate(video, pendingRate);
    hideNudge();
  }, 2000);
}

function showSkipNudge(secondsRemaining) {
  nudgeActive = true;

  const nudge = document.getElementById("focus-coach-nudge");
  const text = document.getElementById("fc-nudge-text");
  text.textContent = `${secondsRemaining}s from your target, hang in there`;
  nudge.style.display = "flex";

  nudgeTimeout = setTimeout(() => {
    console.log("Focus Coach: skip timeout fired, navigating now");
    window.location.href = pendingNavigationUrl;
  }, 2000);
}

function confirmNudge() {
  clearTimeout(nudgeTimeout);

  if (pendingNavigationUrl) {
    console.log("Focus Coach: confirm clicked, navigating now");
    window.location.href = pendingNavigationUrl;
    pendingNavigationUrl = null;
  } else if (pendingRate) {
    const video = findVideoElement();
    console.log("Focus Coach: confirm clicked, attempting to set rate to:", pendingRate);
    setPlaybackRate(video, pendingRate);
  }

  hideNudge();
}

function hideNudge() {
  nudgeActive = false;
  pendingNavigationUrl = null;
  const nudge = document.getElementById("focus-coach-nudge");
  if (nudge) nudge.style.display = "none";
}

async function handlePotentialSkipClick(event) {
  const link = event.target.closest('a[href*="/watch?v="]');
  if (!link) return;

  if (nudgeActive) return;
  if (await isSnoozed()) return;

  const remaining = TARGET_SECONDS - currentElapsedSeconds;
  if (remaining <= 0) return;

  console.log("Focus Coach: early skip attempt detected, remaining:", remaining);

  event.preventDefault();
  event.stopPropagation();

  pendingNavigationUrl = link.href;
  showSkipNudge(remaining);
}

function waitForVideo() {
  const video = findVideoElement();

  if (video) {
    console.log("Focus Coach: video element found", video);
    createOverlay();
    createNudge();
    attachListeners(video);
  } else {
    setTimeout(waitForVideo, 500);
  }
}

async function startWatchSession() {
  watchStartTime = Date.now();
  currentVideoId = getVideoIdFromUrl();
  targetCelebrated = false;
  console.log("Focus Coach: watch session started for video", currentVideoId);

  const snoozed = await isSnoozed();
  const overlay = document.getElementById("focus-coach-overlay");

  if (snoozed) {
    console.log("Focus Coach: training snoozed, tracking silently");
    if (overlay) overlay.style.display = "none";
  } else {
    if (overlay) overlay.style.display = "flex";
    ringInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - watchStartTime) / 1000);
      updateRing(elapsed);
    }, 250);
  }
}

function endWatchSession(reason) {
  if (watchStartTime === null) return;

  const watchedSeconds = Math.round((Date.now() - watchStartTime) / 1000);
  console.log(`Focus Coach: watch session ended (${reason}), duration: ${watchedSeconds}s`);

  chrome.runtime.sendMessage({
    type: "SESSION_ENDED",
    videoId: currentVideoId,
    watchedSeconds: watchedSeconds,
    targetSeconds: TARGET_SECONDS,
    hitTarget: watchedSeconds >= TARGET_SECONDS,
    reason: reason,
    timestamp: Date.now()
  });

  clearInterval(ringInterval);
  watchStartTime = null;
}

function attachListeners(video) {
  video.addEventListener("play", () => {
    startWatchSession();
  });

  video.addEventListener("pause", () => {
    endWatchSession("paused");
  });

  video.addEventListener("ended", () => {
    endWatchSession("video ended");
  });

  video.addEventListener("ratechange", async () => {
    if (programmaticChange) {
      programmaticChange = false;
      console.log("Focus Coach: ignoring our own programmatic rate change");
      return;
    }

    if (await isSnoozed()) return;

    console.log("Focus Coach: ratechange fired, current rate is now:", video.playbackRate, "| nudgeActive:", nudgeActive);

    if (nudgeActive) return;

    const requestedRate = video.playbackRate;
    const remaining = TARGET_SECONDS - currentElapsedSeconds;

    if (requestedRate > 1 && remaining > 0) {
      console.log("Focus Coach: early speed-up attempt detected, requested:", requestedRate, "remaining:", remaining);
      setPlaybackRate(video, 1);
      showNudge(remaining, requestedRate, video);
    }
  });
}

function fetchTarget() {
  chrome.runtime.sendMessage({ type: "GET_TARGET" }, (response) => {
    if (response && response.target) {
      TARGET_SECONDS = response.target;
      console.log("Focus Coach: today's target set to", TARGET_SECONDS, "seconds");
    }
  });
}

document.addEventListener("click", handlePotentialSkipClick, true);

let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    console.log("Focus Coach: navigated to new page/video");
    endWatchSession("navigated away");
    lastUrl = window.location.href;
    disableAutoplay();
  }
}, 1000);

fetchTarget();
waitForVideo();
disableAutoplay();