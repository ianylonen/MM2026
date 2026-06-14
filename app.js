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

async function main() {
  const data = await fetch("data.json", { cache: "no-store" }).then(r => r.json());

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
    <td class="rank">${row.displayRank}</td><td class="name">${row.name}</td><td>${n(row.matchPoints)}</td><td class="negative">${n(row.penaltyPoints)}</td><td>${n(row.finalPoints)}</td><td class="total">${n(row.total)}</td><td>${Number(row.total) === Number(leader?.total) ? "–" : n(Number(leader?.total || 0) - Number(row.total || 0))}</td><td>${row.gold || ""}</td><td>${row.silver || ""}</td>
  </tr>`).join("");

  const indexBody = document.querySelector("#indexTable tbody");
  indexBody.innerHTML = comparisonIndexes.map(row => `<tr>
    <td class="name">${row.name}</td><td class="total">${n(row.total)}</td><td>${Number(row.total) === Number(leader?.total) ? "–" : n(Number(leader?.total || 0) - Number(row.total || 0))}</td>
  </tr>`).join("") || `<tr><td colspan="3" class="empty">Vertailuindeksejä ei löydy.</td></tr>`;

  document.getElementById("recentMatches").innerHTML = (data.recentMatches || []).map(m => matchCard(m, false)).join("") || `<p class="empty">Ei pelattuja otteluita.</p>`;
  document.getElementById("upcomingMatches").innerHTML = (data.upcomingMatches || []).map(m => matchCard(m, true)).join("") || `<p class="empty">Ei tulevia otteluita.</p>`;
}
main().catch(err => { document.body.insertAdjacentHTML("beforeend", `<pre class="error">${err.message}</pre>`); });
