const API = "https://script.google.com/macros/s/AKfycbwdlVElxX6DOJ1tIxvsSwwgc3E85MMWoa7NuKrKh6em2bzZQXucVT4CsNxO_2s1uk1n/exec"; // replace with your Google Apps Script deployment URL

let username = "";

function login() {
  const passcode = document.getElementById("passcode").value;
  console.log("Logging in with passcode:", passcode);

  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // important for Apps Script
    body: JSON.stringify({ action: "login", passcode })
  })
  .then(r => r.json())
  .then(d => {
    console.log("Login response:", d);
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
  .catch(err => console.error("Login error:", err));
}

function loadFixtures() {
  console.log("Fetching fixtures...");
  fetch(API + "?action=fixtures")
    .then(r => r.json())
    .then(fx => {
      console.log("Fixtures:", fx);
      let html = "<table><tr><th>GW</th><th>Date</th><th>Home</th><th>Away</th><th>Pick</th></tr>";
      fx.forEach(f => {
        html += `<tr>
          <td>${f.gw}</td><td>${f.date}</td>
          <td>${f.home}</td><td>${f.away}</td>
          <td>
            <button onclick="pick('${f.gw}','${f.home}')">${f.home}</button>
            <button onclick="pick('${f.gw}','${f.away}')">${f.away}</button>
          </td>
        </tr>`;
      });
      html += "</table>";
      document.getElementById("fixtures").innerHTML = html;
    })
    .catch(err => console.error("Fixtures error:", err));
}

function pick(gw, team) {
  console.log(`Picking ${team} for GW ${gw}`);
  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pick", username, gw, team })
  })
  .then(r => r.json())
  .then(d => {
    console.log("Pick response:", d);
    if (d.success) {
      alert(`Picked ${team} for GW${gw}`);
      loadLeaderboard();
    }
  })
  .catch(err => console.error("Pick error:", err));
}

function loadLeaderboard() {
  console.log("Fetching leaderboard...");
  fetch(API + "?action=leaderboard")
    .then(r => r.json())
    .then(lb => {
      console.log("Leaderboard:", lb);
      let html = "<table><tr><th>Player</th><th>Picks</th></tr>";
      lb.forEach(p => {
        html += `<tr>
          <td>${p.name}</td>
          <td>${p.picks.map(pk => `${pk.team}(${pk.result || ''})`).join(', ')}</td>
        </tr>`;
      });
      html += "</table>";
      document.getElementById("leaderboard").innerHTML = html;
    })
    .catch(err => console.error("Leaderboard error:", err));
}
