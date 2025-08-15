const API = "https://script.google.com/macros/s/AKfycby1zxH-ITW8wlQxThrNiSk2gk95GINLofLOOfYrCc_1qoJpqMHkKOJQ5syO3F3iy-8j/exec"; // Replace with your deployed Apps Script URL
let username = "";
let pendingPick = {};

// --- JSONP helper to bypass CORS ---
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");
    script.src = `${url}${sep}callback=${cb}`;
    script.async = true;

    window[cb] = (data) => {
      resolve(data);
      cleanup();
    };
    script.onerror = () => {
      reject(new Error("JSONP request failed"));
      cleanup();
    };
    function cleanup() {
      delete window[cb];
      script.remove();
    }
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
        loadFixtures();
        loadLeaderboard();
      } else {
        alert("Wrong passcode");
      }
    })
    .catch(() => alert("Network error logging in"));
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

function loadFixtures() {
  jsonp(`${API}?action=fixtures`)
    .then(fx => {
      return jsonp(`${API}?action=leaderboard`).then(lb => ({ fx, lb }));
    })
    .then(({ fx, lb }) => {
      const myEntry = (lb || []).find(p => p.name === username);
      const myPicksGW = myEntry ? myEntry.picks.map(pk => pk.gw) : [];

      let html = "<table><tr><th>GW</th><th>Date</th><th>Home</th><th>Away</th><th>Pick</th></tr>";
      fx.forEach(f => {
        const kickoffPassed = new Date(f.date) < new Date();
        const alreadyPicked = myPicksGW.includes(f.gw);
        const disableBtn = kickoffPassed || alreadyPicked ? "disabled" : "";
        const matchStr = `${f.home} vs ${f.away}`;
        html += `<tr>
          <td>${f.gw}</td>
          <td>${new Date(f.date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
          <td>${f.home}</td><td>${f.away}</td>
          <td>
            <button ${disableBtn} onclick="showModal('${f.gw}','${f.home}','${matchStr}')">${f.home}</button>
            <button ${disableBtn} onclick="showModal('${f.gw}','${f.away}','${matchStr}')">${f.away}</button>
          </td>
        </tr>`;
      });
      html += "</table>";
      document.getElementById("fixtures").innerHTML = html;

      // Show a small summary of your picks
      if (myEntry) {
        document.getElementById("yourPick").innerHTML = 
          `<div>Your picks: ${myEntry.picks.map(p => `<span class="chip">GW${p.gw}: ${p.team}${p.result? " ("+p.result+")":""}</span>`).join(" ")}</div>`;
      }
    })
    .catch(() => {
      document.getElementById("fixtures").innerHTML = "<p>Couldn't load fixtures.</p>";
    });
}

function pick(gw, team) {
  const u = encodeURIComponent(username);
  const t = encodeURIComponent(team);
  const g = encodeURIComponent(gw);
  jsonp(`${API}?action=pick&username=${u}&gw=${g}&team=${t}`)
    .then(d => {
      if (d.success) {
        alert(`Picked ${team} for GW${gw}`);
        loadLeaderboard();
      } else {
        alert("Failed to save pick");
      }
    })
    .catch(() => alert("Network error saving pick"));
}

function loadLeaderboard() {
  jsonp(`${API}?action=leaderboard`)
    .then(lb => {
      let html = "<table><tr><th>Player</th><th>Picks</th></tr>";
      (lb || []).forEach(p => {
        html += `<tr><td>${p.name}</td><td>${p.picks.map(pk => `${pk.team}(${pk.result||''})`).join(', ')}</td></tr>`;
      });
      html += "</table>";
      document.getElementById("leaderboard").innerHTML = html;
    })
    .catch(() => {
      document.getElementById("leaderboard").innerHTML = "<p>Couldn't load leaderboard.</p>";
    });
}
