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

function createOverlay() {
  if (document.getElementById("focus-coach-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "focus-coach-overlay";
  overlay.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="20" class="fc-ring-bg" />
      <circle cx="24" cy="24" r="20" class="fc-ring-progress" id="fc-ring-progress" />
    </svg>
    <div id="fc-time-label">0:00</div>
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

  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  label.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
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

function handlePotentialSkipClick(event) {
  const link = event.target.closest('a[href*="/watch?v="]');
  if (!link) return;

  if (nudgeActive) return;

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

function startWatchSession() {
  watchStartTime = Date.now();
  currentVideoId = getVideoIdFromUrl();
  console.log("Focus Coach: watch session started for video", currentVideoId);

  ringInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - watchStartTime) / 1000);
    updateRing(elapsed);
  }, 250);
}

function endWatchSession(reason) {
  if (watchStartTime === null) return;

  const watchedSeconds = Math.round((Date.now() - watchStartTime) / 1000);
  console.log(`Focus Coach: watch session ended (${reason}), duration: ${watchedSeconds}s`);

  // send this session to background.js for permanent storage
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

  video.addEventListener("ratechange", () => {
    if (programmaticChange) {
      programmaticChange = false;
      console.log("Focus Coach: ignoring our own programmatic rate change");
      return;
    }

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

let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    console.log("Focus Coach: navigated to new page/video");
    endWatchSession("navigated away");
    lastUrl = window.location.href;
  }
}, 1000);

function fetchTarget() {
  chrome.runtime.sendMessage({ type: "GET_TARGET" }, (response) => {
    if (response && response.target) {
      TARGET_SECONDS = response.target;
      console.log("Focus Coach: today's target set to", TARGET_SECONDS, "seconds");
    }
  });
}

document.addEventListener("click", handlePotentialSkipClick, true);

fetchTarget();
waitForVideo();