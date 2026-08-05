console.log("Focus Coach: background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SESSION_ENDED") {
    saveSession(message);
  }
});

async function saveSession(session) {
  const result = await chrome.storage.local.get(["sessions"]);
  const sessions = result.sessions || [];

  sessions.push(session);

  await chrome.storage.local.set({ sessions: sessions });
  console.log("Focus Coach: session saved, total sessions stored:", sessions.length);
}