const API = "https://script.google.com/macros/s/AKfycbwdlVElxX6DOJ1tIxvsSwwgc3E85MMWoa7NuKrKh6em2bzZQXucVT4CsNxO_2s1uk1n/exec"; // Replace with your deployed Apps Script URL
let username = "";
let pendingPick = {};

function login() {
  const passcode = document.getElementById("passcode").value;
  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", passcode })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.success){
      username = d.username;
      document.getElementById("login").style.display = "none";
      document.getElementById("game").style.display = "block";
      document.getElementById("username").innerText = username;
      loadFixtures();
      loadLeaderboard();
    } else {
      alert("Wrong passcode");
    }
  });
}

function showModal(gw, team, match) {
  pendingPick = { gw, team, match };
  document.getElementById("modalMatch").innerText = `GW${gw}: ${match} → ${team}`;
  document.getElementById("pickModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("pickModal").style.display = "none";
}

document.getElementById("confirmPickBtn").addEventListener("click", () => {
  pick(pendingPick.gw, pendingPick.team);
  closeModal();
});

function loadFixtures() {
  fetch(API + "?action=fixtures")
    .then(r => r.json())
    .then(fx => {
      fetch(API + "?action=leaderboard")
        .then(r => r.json())
        .then(lb => {
          const myEntry = lb.find(p => p.name === username);
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
        });
    });
}

function pick(gw, team) {
  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pick", username, gw, team })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.success) {
      alert(`Picked ${team} for GW${gw}`);
      loadLeaderboard();
    }
  });
}

function loadLeaderboard() {
  fetch(API + "?action=leaderboard")
    .then(r => r.json())
    .then(lb => {
      let html = "<table><tr><th>Player</th><th>Picks</th></tr>";
      lb.forEach(p => {
        html += `<tr><td>${p.name}</td><td>${p.picks.map(pk => `${pk.team}(${pk.result||''})`).join(', ')}</td></tr>`;
      });
      html += "</table>";
      document.getElementById("leaderboard").innerHTML = html;
    });
}
