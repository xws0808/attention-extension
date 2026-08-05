console.log("Focus Coach: background script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SESSION_ENDED") {
    saveSession(message);
  }

  if (message.type === "GET_TARGET") {
    calculateTarget().then((target) => {
      sendResponse({ target: target });
    });
    return true; // keeps the message channel open for the async response
  }
});

async function saveSession(session) {
  const result = await chrome.storage.local.get(["sessions"]);
  const sessions = result.sessions || [];

  sessions.push(session);

  await chrome.storage.local.set({ sessions: sessions });
  console.log("Focus Coach: session saved, total sessions stored:", sessions.length);
}

async function calculateTarget() {
  const result = await chrome.storage.local.get(["sessions"]);
  const sessions = result.sessions || [];

  if (sessions.length === 0) {
    return 60; // no history yet, default starting target
  }

  // use the most recent 10 sessions to calculate a rolling average
  const recentSessions = sessions.slice(-10);
  const totalSeconds = recentSessions.reduce((sum, s) => sum + s.watchedSeconds, 0);
  const average = totalSeconds / recentSessions.length;

  // progressive overload: today's target is 10% above your recent average,
  // but never more than 30 seconds higher than your last target
  const lastTarget = recentSessions[recentSessions.length - 1].targetSeconds;
  const proposedTarget = Math.round(average * 1.1);
  const cappedTarget = Math.min(proposedTarget, lastTarget + 30);

  return Math.max(cappedTarget, 15); // never go below a 15s floor
}