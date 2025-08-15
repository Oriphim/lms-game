// Frontend using standard fetch() via Cloudflare Worker (no JSONP needed)
const API = "https://lms-proxy.htsangers2004.workers.dev/"; // <-- replace after deploying Worker
let username = "";
let state = {
  gw: null,
  firstKickoff: null,
  fixtures: [],
  thisWeekPicks: [],
  myUsedTeams: [],
  myPick: null,
};
let pendingPick = {};

// Local cache for instant paint
function cacheKey(u) { return `lmsBundle_${u}`; }
function saveCache(u, data) { try { localStorage.setItem(cacheKey(u), JSON.stringify({ ts: Date.now(), data })); } catch {} }
function loadCache(u, maxAgeMs = 10 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(cacheKey(u));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > maxAgeMs) return null;
    return data;
  } catch { return null; }
}

async function fetchJSON(url, options={}) {
  const res = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function login() {
  const passcode = document.getElementById("passcode").value.trim();
  fetchJSON(`${API}?action=login`, { method: "POST", body: JSON.stringify({ action: "login", passcode }) })
    .then(d => {
      if (d.success) {
        username = d.username;
        document.getElementById("login").style.display = "none";
        document.getElementById("game").style.display = "block";
        document.getElementById("username").innerText = username;

        const cached = loadCache(username);
        if (cached) applyBundle(cached);
        loadBundle(!cached);
      } else {
        alert("Wrong passcode");
      }
    })
    .catch(() => alert("Network error logging in"));
}

function loadBundle(bypass = false) {
  const bp = bypass ? "&bypass=1" : "";
  return fetchJSON(`${API}?action=bundle&u=${encodeURIComponent(username)}${bp}`)
    .then(applyBundle)
    .catch(() => { document.getElementById("fixtures").innerHTML = "<p>Couldn't load data.</p>"; });
}

function applyBundle(data) {
  state = {
    gw: data.gw,
    firstKickoff: data.firstKickoff ? new Date(data.firstKickoff) : null,
    fixtures: data.fixtures || [],
    thisWeekPicks: data.thisWeekPicks || [],
    myUsedTeams: data.myUsedTeams || [],
    myPick: data.myPick || null,
  };
  saveCache(username, data);
  renderAll();
}

function renderAll() {
  document.getElementById("gwLabel").innerText = state.gw ?? "?";
  document.getElementById("gwLabel2").innerText = state.gw ?? "?";

  const li = document.getElementById("lockInfo");
  if (state.firstKickoff) {
    const d = state.firstKickoff;
    li.textContent = `— picks lock at ${d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
  } else {
    li.textContent = "";
  }

  renderNotice();
  renderThisWeeksPicks();
  renderFixtures();
}

function renderNotice() {
  const n = document.getElementById("notice");
  const now = new Date();
  const locked = state.firstKickoff && now >= state.firstKickoff;
  if (state.myPick && state.myPick.team) {
    n.innerHTML = `<div class="notice">
      You have already picked <b>${state.myPick.team}</b> for <b>GW ${state.gw}</b>.
      ${locked ? "Picks are locked." : "You can still change before first kickoff."}
    </div>`;
  } else {
    n.innerHTML = locked ? `<div class="notice">Picks are locked for <b>GW ${state.gw}</b>.</div>` : "";
  }
}

function renderThisWeeksPicks() {
  const rows = state.thisWeekPicks.map(p => `<tr><td>${p.name}</td><td>${p.team || ""}</td></tr>`);
  const html = `<table><tr><th>Player</th><th>Team</th></tr>${rows.join("")}</table>`;
  document.getElementById("thisWeekPicks").innerHTML = html;
}

function renderFixtures() {
  const now = new Date();
  const locked = state.firstKickoff && now >= state.firstKickoff;
  let html = "<table><tr><th>Kickoff (UK)</th><th>Home</th><th>Away</th><th>Pick</th></tr>";
  state.fixtures.forEach(f => {
    const matchStr = `${f.home} vs ${f.away}`;
    const isMyHome = state.myPick && state.myPick.team === f.home;
    const isMyAway = state.myPick && state.myPick.team === f.away;

    const homeUsed = state.myUsedTeams.includes(f.home) && !isMyHome;
    const awayUsed = state.myUsedTeams.includes(f.away) && !isMyAway;

    const homeDisabled = locked || homeUsed ? "disabled" : "";
    const awayDisabled = locked || awayUsed ? "disabled" : "";

    const homeCls = isMyHome ? "picked" : (homeUsed ? "used" : "");
    const awayCls = isMyAway ? "picked" : (awayUsed ? "used" : "");

    const homeTitle = homeUsed ? 'title="Already used this team"' : "";
    const awayTitle = awayUsed ? 'title="Already used this team"' : "";

    html += `<tr>
      <td>${new Date(f.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
      <td>${f.home}</td><td>${f.away}</td>
      <td>
        <button ${homeDisabled} class="${homeCls}" ${homeTitle}
          onclick="showModal('${state.gw}','${f.home}','${matchStr}')">${isMyHome ? "Your pick: " : ""}${f.home}</button>
        <button ${awayDisabled} class="${awayCls}" ${awayTitle}
          onclick="showModal('${state.gw}','${f.away}','${matchStr}')">${isMyAway ? "Your pick: " : ""}${f.away}</button>
      </td>
    </tr>`;
  });
  html += "</table>";
  document.getElementById("fixtures").innerHTML = html;
}

function showModal(gw, team, match) {
  pendingPick = { gw, team, match };
  document.getElementById("modalMatch").innerText = `GW${gw}: ${match} → ${team}`;
  document.getElementById("pickModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("pickModal").style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("confirmPickBtn");
  if (btn) btn.addEventListener("click", confirmPick);
});

function confirmPick() {
  const btn = document.getElementById("confirmPickBtn");
  btn.disabled = true;

  // Optimistic UI
  const prev = JSON.parse(JSON.stringify(state));
  applyOptimisticPick(pendingPick.gw, pendingPick.team);
  closeModal();

  fetchJSON(`${API}?action=pick`, { method: "POST", body: JSON.stringify({ action:"pick", username, gw: pendingPick.gw, team: pendingPick.team }) })
    .then(() => loadBundle(true))
    .catch(() => { alert("Save failed, reverting"); state = prev; renderAll(); })
    .finally(() => { btn.disabled = false; });
}

function applyOptimisticPick(gw, team) {
  state.myPick = { gw, team };
  let found = false;
  state.thisWeekPicks = state.thisWeekPicks.map(p => {
    if (p.name === username) { found = true; return { name: p.name, team }; }
    return p;
  });
  if (!found) state.thisWeekPicks.push({ name: username, team });
  if (!state.myUsedTeams.includes(team)) state.myUsedTeams.push(team);
  renderAll();
}
