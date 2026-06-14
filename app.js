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
function predictionChips(match, compact=false) {
  const entries = Object.entries(match.predictions || {});
  return `<div class="chips ${compact ? "compact" : ""}">${entries.map(([name, pred]) => `<span class="chip${predClass(pred, match.result)}"><b>${name}</b> ${pred || "–"}</span>`).join("")}</div>`;
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
  document.title = data.title || document.title;
  document.getElementById("updated").textContent = d(data.generatedAt);
  document.getElementById("completed").textContent = `${data.completedMatches}/${data.totalMatches}`;
  document.getElementById("leader").textContent = data.standings?.[0]?.name || "–";
  document.getElementById("leaderPoints").textContent = n(data.standings?.[0]?.total);

  const tbody = document.querySelector("#standingsTable tbody");
  tbody.innerHTML = (data.standings || []).map(row => `<tr>
    <td class="rank">${row.rank}</td><td class="name">${row.name}</td><td>${n(row.matchPoints)}</td><td class="negative">${n(row.penaltyPoints)}</td><td>${n(row.finalPoints)}</td><td class="total">${n(row.total)}</td><td>${row.gapFromLeader === 0 ? "–" : n(row.gapFromLeader)}</td><td>${row.gold || ""}</td><td>${row.silver || ""}</td>
  </tr>`).join("");

  document.getElementById("recentMatches").innerHTML = (data.recentMatches || []).map(m => matchCard(m, false)).join("") || `<p class="empty">Ei pelattuja otteluita.</p>`;
  document.getElementById("upcomingMatches").innerHTML = (data.upcomingMatches || []).map(m => matchCard(m, true)).join("") || `<p class="empty">Ei tulevia otteluita.</p>`;
}
main().catch(err => { document.body.insertAdjacentHTML("beforeend", `<pre class="error">${err.message}</pre>`); });
