console.log("Focus Coach: content script loaded");

let watchStartTime = null;
let currentVideoId = null;

function getVideoIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("v");
}

function findVideoElement() {
  return document.querySelector("video");
}

function waitForVideo() {
  const video = findVideoElement();

  if (video) {
    console.log("Focus Coach: video element found", video);
    attachListeners(video);
  } else {
    setTimeout(waitForVideo, 500);
  }
}

function startWatchSession() {
  watchStartTime = Date.now();
  currentVideoId = getVideoIdFromUrl();
  console.log("Focus Coach: watch session started for video", currentVideoId);
}

function endWatchSession(reason) {
  if (watchStartTime === null) return;

  const watchedSeconds = Math.round((Date.now() - watchStartTime) / 1000);
  console.log(`Focus Coach: watch session ended (${reason}), duration: ${watchedSeconds}s`);

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
}

let lastUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== lastUrl) {
    console.log("Focus Coach: navigated to new page/video");
    endWatchSession("navigated away");
    lastUrl = window.location.href;
  }
}, 1000);

waitForVideo();