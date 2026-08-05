console.log("Focus Coach: popup opened");

async function loadDashboard() {
  const result = await chrome.storage.local.get(["sessions"]);
  const sessions = result.sessions || [];

  renderStreak(sessions);
  renderTarget(sessions);
  renderTodaySessions(sessions);
  renderWeeklyChart(sessions);
  renderSnoozeStatus();
}

function getDateString(timestamp) {
  return new Date(timestamp).toDateString();
}

function renderStreak(sessions) {
  const hitDates = new Set(
    sessions.filter(s => s.hitTarget).map(s => getDateString(s.timestamp))
  );

  let streak = 0;
  let checkDate = new Date();

  while (hitDates.has(checkDate.toDateString())) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  document.getElementById("streak-value").textContent = streak;
}

function renderTarget(sessions) {
  if (sessions.length === 0) {
    document.getElementById("target-value").textContent = "60s";
    document.getElementById("level-badge").textContent = "Level 1";
    return;
  }

  const lastSession = sessions[sessions.length - 1];
  const target = lastSession.targetSeconds;

  document.getElementById("target-value").textContent = `${target}s`;

  const level = Math.max(1, Math.floor(target / 30) + 1);
  document.getElementById("level-badge").textContent = `Level ${level}`;
}

function renderTodaySessions(sessions) {
  const today = new Date().toDateString();
  const todayCount = sessions.filter(s => getDateString(s.timestamp) === today).length;
  document.getElementById("today-sessions").textContent = todayCount;
}

function renderWeeklyChart(sessions) {
  const chart = document.getElementById("weekly-chart");
  chart.innerHTML = "";

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const maxWatch = Math.max(
    ...sessions.map(s => s.watchedSeconds),
    30
  );

  days.forEach((day) => {
    const dayStr = day.toDateString();
    const daySessions = sessions.filter(s => getDateString(s.timestamp) === dayStr);
    const totalSeconds = daySessions.reduce((sum, s) => sum + s.watchedSeconds, 0);
    const avgSeconds = daySessions.length > 0 ? totalSeconds / daySessions.length : 0;

    const barWrapper = document.createElement("div");
    barWrapper.style.display = "flex";
    barWrapper.style.flexDirection = "column";
    barWrapper.style.flex = "1";
    barWrapper.style.alignItems = "center";

    const bar = document.createElement("div");
    bar.className = "day-bar";
    const heightPercent = Math.max((avgSeconds / maxWatch) * 100, 2);
    bar.style.height = `${heightPercent}%`;

    const label = document.createElement("div");
    label.className = "day-label";
    label.textContent = day.toLocaleDateString("en-US", { weekday: "narrow" });

    const barContainer = document.createElement("div");
    barContainer.style.flex = "1";
    barContainer.style.width = "100%";
    barContainer.style.display = "flex";
    barContainer.style.alignItems = "flex-end";
    barContainer.appendChild(bar);

    barWrapper.appendChild(barContainer);
    barWrapper.appendChild(label);
    chart.appendChild(barWrapper);
  });
}

async function renderSnoozeStatus() {
  const result = await chrome.storage.local.get(["snooze"]);
  const snooze = result.snooze;

  const statusEl = document.getElementById("snooze-status");
  const buttonsEl = document.querySelector(".snooze-buttons");
  const resumeBtn = document.getElementById("resume-btn");

  const isActive = snooze && snooze.until && snooze.until > Date.now();

  if (isActive) {
    const minsLeft = Math.ceil((snooze.until - Date.now()) / 60000);
    statusEl.textContent = snooze.type === "video"
      ? "Snoozed for this video"
      : `Snoozed, ${minsLeft} min left`;
    buttonsEl.style.display = "none";
    resumeBtn.style.display = "block";
  } else {
    statusEl.textContent = "Active";
    buttonsEl.style.display = "flex";
    resumeBtn.style.display = "none";
  }
}

async function setSnooze(type) {
  let until;
  if (type === "video") {
    until = Date.now() + 1000 * 60 * 60 * 6; // safety-net cap of 6hrs
  } else {
    until = Date.now() + 1000 * 60 * 60; // 1 hour
  }

  await chrome.storage.local.set({
    snooze: { type: type, until: until }
  });

  renderSnoozeStatus();
}

async function clearSnooze() {
  await chrome.storage.local.set({ snooze: null });
  renderSnoozeStatus();
}

document.getElementById("snooze-video-btn").addEventListener("click", () => setSnooze("video"));
document.getElementById("snooze-hour-btn").addEventListener("click", () => setSnooze("time"));
document.getElementById("resume-btn").addEventListener("click", clearSnooze);

loadDashboard();