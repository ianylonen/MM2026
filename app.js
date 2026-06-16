const fmt = new Intl.NumberFormat("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dtf = new Intl.DateTimeFormat("fi-FI", { dateStyle: "short", timeStyle: "short" });

function n(value) { return fmt.format(Number(value || 0)); }
function d(value) { return value ? dtf.format(new Date(value)) : "–"; }
function flag(src, alt) { return src ? `<img class="flag" src="${src}" alt="${alt}">` : ""; }
function resultText(m) { return m.score ? `${m.score} · ${m.result}` : (m.result || "–"); }
function predClass(pred, result) {
  const clean = String(pred ?? "").replace(/\s/g, "");
  if (!result) return "";
  return clean.includes(result) ? " hit" : " miss";
}
function cleanPrediction(value) {
  return String(value ?? "").replace(/\s/g, "");
}

function containsResult(prediction, result) {
  return Boolean(result) && cleanPrediction(prediction).includes(result);
}
const NON_COMPETITOR_NAMES = new Set(["Ykkösrivi", "Ristirivi", "Kakkosrivi"]);

function isNonCompetitor(name) {
  return NON_COMPETITOR_NAMES.has(String(name || ""));
}

function addDisplayRanks(rows) {
  let previousTotal = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const total = Number(row.total || 0);
    const rank = previousTotal !== null && total === previousTotal ? previousRank : index + 1;
    previousTotal = total;
    previousRank = rank;
    return { ...row, displayRank: rank };
  });
}

function visiblePredictionEntries(match) {
  return Object.entries(match.predictions || {})
    .filter(([name]) => !isNonCompetitor(name));
}

function predictionGroups(entries) {
  const groups = { "1": [], "X": [], "2": [] };
  for (const [name, pred] of entries) {
    const clean = String(pred || "").replace(/\s/g, "");
    if (clean.includes("1")) groups["1"].push(name);
    if (clean.includes("X")) groups["X"].push(name);
    if (clean.includes("2")) groups["2"].push(name);
  }
  return groups;
}

function predictionChips(match, compact=false) {
  const entries = visiblePredictionEntries(match);
  const groups = predictionGroups(entries);
  const rows = ["1", "X", "2"].map(mark => {
    const names = groups[mark];
    const label = `${mark} (${names.length})`;
    const nameList = names.length ? names.join(", ") : "–";
    return `<div class="prediction-group-row">
      <span class="prediction-mark">${label}</span>
      <span class="prediction-names">${nameList}</span>
    </div>`;
  }).join("");
  return `<div class="prediction-block prediction-groups" aria-label="Veikkausjakauma pelaajittain">${rows}</div>`;
}
function matchCard(match, showPredictions=false) {
  return `<article class="match-card">
    <div class="match-main">
      <div class="teams"><span>${flag(match.homeFlag, match.home)}${match.home}</span><small>–</small><span>${flag(match.awayFlag, match.away)}${match.away}</span></div>
      <div class="score">${resultText(match)}</div>
    </div>
    <div class="match-meta"><span>Lohko ${match.group || ""}</span><span>${d(match.date)}</span></div>
    ${showPredictions ? predictionChips(match, true) : ""}
  </article>`;
}

function openPlayerCard(playerName, data) {
  const player = (data.standings || []).find(p => p.name === playerName);
  if (!player) return;

  const completed = (data.matches || []).filter(m => m.result);
  const correct = [];
  const wrong = [];

  for (const match of completed) {
    const prediction = match.predictions?.[playerName];
    if (!prediction) continue;

    const item = `${match.match}: ${prediction} → ${match.result}`;

    if (containsResult(prediction, match.result)) {
      correct.push(item);
    } else {
      wrong.push(item);
    }
  }

  const accuracy =
    completed.length > 0
      ? `${correct.length} / ${completed.length} (${fmt.format((correct.length / completed.length) * 100)} %) `
      : "–";

  document.getElementById("playerCardContent").innerHTML = `
    <h2>${player.name}</h2>

    <div class="player-card-grid">
      <div class="player-card-stat"><span>Ottelupisteet</span><strong>${n(player.matchPoints)}</strong></div>
      <div class="player-card-stat"><span>Miinuspisteet</span><strong>${n(player.penaltyPoints)}</strong></div>
      <div class="player-card-stat"><span>Yhteensä</span><strong>${n(player.total)}</strong></div>
      <div class="player-card-stat"><span>Osumatarkkuus</span><strong>${accuracy}</strong></div>
      <div class="player-card-stat"><span>Kulta</span><strong>${player.gold || "–"}</strong></div>
      <div class="player-card-stat"><span>Hopea</span><strong>${player.silver || "–"}</strong></div>
    </div>

    <div class="pick-list">
      <h3>Oikein</h3>
      <ul>
        ${correct.length ? correct.map(x => `<li>✓ ${x}</li>`).join("") : "<li>–</li>"}
      </ul>

      <h3>Väärin</h3>
      <ul>
        ${wrong.length ? wrong.map(x => `<li>✗ ${x}</li>`).join("") : "<li>–</li>"}
      </ul>
    </div>
  `;

  document.getElementById("playerModal").classList.remove("hidden");
}

function closePlayerCard() {
  document.getElementById("playerModal").classList.add("hidden");
}

document.addEventListener("click", event => {
  if (event.target?.id === "modalClose" || event.target?.id === "modalBackdrop") {
    closePlayerCard();
  }
});

async function main() {
  const data = await fetch(`data.json?v=${Date.now()}`, { cache: "no-store" }).then(r => r.json());

  const allStandings = data.standings || [];
  const competitors = addDisplayRanks(allStandings.filter(row => !isNonCompetitor(row.name)));
  const comparisonIndexes = allStandings.filter(row => isNonCompetitor(row.name));
  const leader = competitors[0];
  
  document.getElementById("updated").textContent = d(data.generatedAt);
  document.getElementById("completed").textContent = `${data.completedMatches}/${data.totalMatches}`;
  document.getElementById("leader").textContent = leader?.name || "–";
  document.getElementById("leaderPoints").textContent = n(leader?.total);

  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = competitors.map(row => `<tr>
    <td class="rank">${row.displayRank}</td><td class="name player-link" data-player="${row.name}">${row.name}</td><td>${n(row.matchPoints)}</td><td class="negative">${n(row.penaltyPoints)}</td><td>${n(row.finalPoints)}</td><td class="total">${n(row.total)}</td><td>${Number(row.total) === Number(leader?.total) ? "–" : n(Number(leader?.total || 0) - Number(row.total || 0))}</td><td>${row.gold || ""}</td><td>${row.silver || ""}</td>
  </tr>`).join("");

  const indexBody = document.querySelector("#indexTable tbody");
  indexBody.innerHTML = comparisonIndexes.map(row => `<tr>
    <td class="name">${row.name}</td><td class="total">${n(row.total)}</td><td>${Number(row.total) === Number(leader?.total) ? "–" : n(Number(leader?.total || 0) - Number(row.total || 0))}</td>
  </tr>`).join("") || `<tr><td colspan="3" class="empty">Vertailuindeksejä ei löydy.</td></tr>`;

  document.getElementById("recentMatches").innerHTML = (data.recentMatches || []).map(m => matchCard(m, false)).join("") || `<p class="empty">Ei pelattuja otteluita.</p>`;
  document.getElementById("upcomingMatches").innerHTML = (data.upcomingMatches || []).map(m => matchCard(m, true)).join("") || `<p class="empty">Ei tulevia otteluita.</p>`;
  document.querySelectorAll(".player-link").forEach(el => {
  el.addEventListener("click", () => openPlayerCard(el.dataset.player, data));
});
}
main().catch(err => { document.body.insertAdjacentHTML("beforeend", `<pre class="error">${err.message}</pre>`); });
