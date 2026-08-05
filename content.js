// Focus Coach - content script
// This runs inside every youtube.com page

console.log("Focus Coach: content script loaded");

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

function attachListeners(video) {
  video.addEventListener("play", () => {
    console.log("Focus Coach: video started playing");
  });

  video.addEventListener("pause", () => {
    console.log("Focus Coach: video paused");
  });

  video.addEventListener("timeupdate", () => {
  });
}

waitForVideo();