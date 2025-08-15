const API = "https://script.google.com/macros/s/AKfycbyCj3smvU3Dr9cbmvfUnIy5gZHh5UyxqyJyf-9FJhLMScnHJ0B9gbUS0GPv4kYO7w5P/exec"; // Replace with your deployed Apps Script URL
let username = "";
let pendingPick = {};
let currentGW = null;
let firstKickoff = null;

// --- JSONP helper ---
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    script.src = `${url}${sep}callback=${cb}`;
    script.async = true;

    window[cb] = (data) => { resolve(data); cleanup(); };
    script.onerror = () => { reject(new Error("JSONP request failed")); cleanup(); };
    function cleanup() { delete window[cb]; script.remove(); }
    document.body.appendChild(script);
  });
}

function login() {
  const passcode = encodeURIComponent(document.getElementById("passcode").value);
  jsonp(`${API}?action=login&passcode=${passcode}`)
    .then(d => {
      if (d.success) {
        username = d.username;
        document.getElementById("login").style.display = "none";
        document.getElementById("game").style.display = "block";
        document.getElementById("username").innerText = username;
        refreshAll();
      } else {
        alert("Wrong passcode");
      }
    })
    .catch(() => alert("Network error logging in"));
}

function refreshAll() {
  // get current gw + fixtures for that week
  jsonp(`${API}?action=current`).then(cur => {
    currentGW = cur.gw;
    firstKickoff = cur.firstKickoff ? new Date(cur.firstKickoff) : null;
    document.getElementById("gwLabel").innerText = currentGW ?? "?";
    document.getElementById("gwLabel2").innerText = currentGW ?? "?";

    // Then load leaderboard to build this week's picks + my pick banner
    jsonp(`${API}?action=leaderboard`).then(lb => {
      renderThisWeeksPicks(lb);
      const my = (lb || []).find(p => p.name === username);
      const myPick = my ? (my.picks.find(pk => String(pk.gw) === String(currentGW)) || null) : null;
      renderNotice(myPick);
      renderFixtures(cur.fixtures, myPick);
    });
  })
  .catch(() => {
    document.getElementById("fixtures").innerHTML = "<p>Couldn't load current gameweek.</p>";
  });
}

function renderNotice(myPick) {
  const n = document.getElementById("notice");
  const now = new Date();
  const locked = firstKickoff && now >= firstKickoff;
  if (myPick && myPick.team) {
    n.innerHTML = `<div class="notice">
      You have already picked <b>${myPick.team}</b> for <b>GW ${currentGW}</b>.
      ${locked ? "Picks are locked." : "You can still change before first kickoff."}
    </div>`;
  } else {
    n.innerHTML = locked ? `<div class="notice">Picks are locked for <b>GW ${currentGW}</b>.</div>` : "";
  }
}

function renderThisWeeksPicks(lb) {
  const rows = [];
  (lb || []).forEach(p => {
    const pick = p.picks.find(pk => String(pk.gw) === String(currentGW));
    rows.push(`<tr><td>${p.name}</td><td>${pick ? pick.team : ""}</td></tr>`);
  });
  const html = `<table><tr><th>Player</th><th>Team</th></tr>${rows.join("")}</table>`;
  document.getElementById("thisWeekPicks").innerHTML = html;
}

function renderFixtures(fixtures, myPick) {
  const now = new Date();
  const locked = firstKickoff && now >= firstKickoff;
  let html = "<table><tr><th>Kickoff (UK)</th><th>Home</th><th>Away</th><th>Pick</th></tr>";
  fixtures.forEach(f => {
    const matchStr = `${f.home} vs ${f.away}`;
    const isMyHome = myPick && myPick.team === f.home;
    const isMyAway = myPick && myPick.team === f.away;
    const canChange = !locked; // allow changes until first kickoff
    const pickDisabled = locked ? "disabled" : "";
    html += `<tr>
      <td>${new Date(f.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
      <td>${f.home}</td><td>${f.away}</td>
      <td>
        <button ${pickDisabled} class="${isMyHome ? "picked": ""}" onclick="showModal('${currentGW}','${f.home}','${matchStr}')">${isMyHome ? "Your pick: " : ""}${f.home}</button>
        <button ${pickDisabled} class="${isMyAway ? "picked": ""}" onclick="showModal('${currentGW}','${f.away}','${matchStr}')">${isMyAway ? "Your pick: " : ""}${f.away}</button>
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
  if (btn) btn.addEventListener("click", () => {
    pick(pendingPick.gw, pendingPick.team);
    closeModal();
  });
});

function pick(gw, team) {
  const u = encodeURIComponent(username);
  const t = encodeURIComponent(team);
  const g = encodeURIComponent(gw);
  jsonp(`${API}?action=pick&username=${u}&gw=${g}&team=${t}`)
    .then(d => {
      if (d.success) {
        alert(`Picked ${team} for GW${gw}`);
        refreshAll();
      } else {
        alert(d.locked ? "Picks are locked for this GW." : "Failed to save pick");
      }
    })
    .catch(() => alert("Network error saving pick"));
}
