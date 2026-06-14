const fmt = new Intl.NumberFormat("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(value) {
  if (!value) return "–";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(d);
}

function points(value) {
  return fmt.format(Number(value || 0));
}

async function loadData() {
  const response = await fetch("data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("data.json ei latautunut");
  return await response.json();
}

function renderStandings(rows) {
  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = "";
  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="rank">${row.rank}</td>
      <td><strong>${row.name}</strong></td>
      <td class="num">${points(row.matchPoints)}</td>
      <td class="num negative">${points(row.penaltyPoints)}</td>
      <td class="num">${points(row.finalPoints)}</td>
      <td class="num total">${points(row.total)}</td>
      <td>${row.gold || "–"}</td>
      <td>${row.silver || "–"}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMatches(data) {
  const recent = data.matches
    .filter(m => m.result)
    .slice()
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  const upcoming = data.matches
    .filter(m => !m.result)
    .slice()
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0, 8);

  const recentEl = document.getElementById("recentMatches");
  recentEl.innerHTML = recent.map(m => `
    <div class="match">
      <div><small>${formatDate(m.date)} · Lohko ${m.group}</small><strong>${m.match}</strong></div>
      <span class="badge done">${m.result}</span>
    </div>
  `).join("") || `<p class="sub">Ei pelattuja otteluita.</p>`;

  const upcomingEl = document.getElementById("upcomingMatches");
  upcomingEl.innerHTML = upcoming.map(m => `
    <div class="match">
      <div><small>${formatDate(m.date)} · Lohko ${m.group}</small><strong>${m.match}</strong></div>
      <span class="badge">–</span>
    </div>
  `).join("") || `<p class="sub">Ei tulevia otteluita.</p>`;
}

loadData().then(data => {
  document.title = data.title || document.title;
  document.getElementById("updated").textContent = formatDate(data.generatedAt);
  document.getElementById("completed").textContent = `${data.completedMatches} / ${data.totalMatches}`;
  const leader = data.standings[0];
  document.getElementById("leader").textContent = leader ? leader.name : "–";
  document.getElementById("leaderPoints").textContent = leader ? points(leader.total) : "–";
  renderStandings(data.standings);
  renderMatches(data);
}).catch(err => {
  document.body.insertAdjacentHTML("afterbegin", `<div style="background:#7f1d1d;color:white;padding:12px 20px">Virhe: ${err.message}</div>`);
});
