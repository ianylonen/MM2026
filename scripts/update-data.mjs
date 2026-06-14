import fs from "node:fs/promises";

const CONFIG_PATH = "config.json";
const DATA_PATH = "data.json";

const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
const apiKey = process.env.FOOTBALL_DATA_API_KEY;

function translateTeam(team) {
  return config.teamTranslations[team] || team;
}

function cleanPrediction(value) {
  return String(value ?? "").replace(/\s/g, "");
}

function containsResult(prediction, result) {
  return result && cleanPrediction(prediction).includes(result);
}

function isDoubleMark(prediction) {
  return String(prediction ?? "").includes(",");
}

function resultFromScore(home, away) {
  if (home === null || home === undefined || away === null || away === undefined) return "";
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

async function fetchApiResults() {
  if (!apiKey) {
    console.log("FOOTBALL_DATA_API_KEY puuttuu: käytetään config.jsonin initialResult-arvoja.");
    return new Map();
  }

  const url = `https://api.football-data.org/v4/competitions/${config.competitionCode || "WC"}/matches`;
  const response = await fetch(url, {
    headers: { "X-Auth-Token": apiKey }
  });

  if (!response.ok) {
    throw new Error(`football-data.org palautti virheen ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const map = new Map();

  for (const match of payload.matches || []) {
    const home = translateTeam(match.homeTeam?.name);
    const away = translateTeam(match.awayTeam?.name);
    const key = `${home} - ${away}`;
    const fullTime = match.score?.fullTime || {};
    const apiResult = match.status === "FINISHED" ? resultFromScore(fullTime.home, fullTime.away) : "";
    map.set(key, {
      result: apiResult,
      status: match.status,
      homeGoals: fullTime.home,
      awayGoals: fullTime.away,
      utcDate: match.utcDate
    });
  }

  return map;
}

function scorePlayer(match, player, result) {
  if (!result) return { matchPoints: 0, penaltyPoints: 0 };
  const prediction = match.predictions[player];

  if (containsResult(prediction, result)) {
    return { matchPoints: Number(match.odds[result] || 0), penaltyPoints: 0 };
  }

  const riskyDouble =
    isDoubleMark(prediction) &&
    Number(match.maxOdds || 0) - Number(match.minOdds || 0) > Number(config.penaltyThreshold || 3.33);

  return { matchPoints: 0, penaltyPoints: riskyDouble ? Number(config.penaltyPoints || -3.33) : 0 };
}

function calculateFinalPoints(player) {
  // Finaalitulosta ei vielä haeta automaattisesti tässä versiossa.
  // Voit lisätä myöhemmin config.finalResult = { "gold": "...", "silver": "..." }.
  const finalResult = config.finalResult;
  if (!finalResult?.gold || !finalResult?.silver) return 0;

  const pick = config.finalPicks[player] || {};
  const gold = pick.gold;
  const silver = pick.silver;
  const actualGold = finalResult.gold;
  const actualSilver = finalResult.silver;

  if (gold === actualGold && silver === actualSilver) return 9;

  let points = 0;
  if (gold === actualGold) points += 5;
  if (silver === actualSilver) points += 2;
  if (gold === actualSilver) points += 1;
  if (silver === actualGold) points += 1;
  if (gold === actualSilver && silver === actualGold) points += 2;
  return points;
}

const apiResults = await fetchApiResults();

const matches = config.matches.map(match => {
  const api = apiResults.get(match.match);
  const result = api?.result || match.initialResult || "";
  return {
    ...match,
    result,
    apiStatus: api?.status || "",
    score: api && api.homeGoals !== null && api.homeGoals !== undefined ? `${api.homeGoals}-${api.awayGoals}` : ""
  };
});

let standings = config.players.map(player => {
  let matchPoints = 0;
  let penaltyPoints = 0;

  for (const match of matches) {
    const scored = scorePlayer(match, player, match.result);
    matchPoints += scored.matchPoints;
    penaltyPoints += scored.penaltyPoints;
  }

  const finalPoints = calculateFinalPoints(player);
  const total = matchPoints + penaltyPoints + finalPoints;
  const finalPick = config.finalPicks[player] || {};

  return {
    name: player,
    matchPoints: Number(matchPoints.toFixed(2)),
    penaltyPoints: Number(penaltyPoints.toFixed(2)),
    finalPoints: Number(finalPoints.toFixed(2)),
    total: Number(total.toFixed(2)),
    gold: finalPick.gold || "",
    silver: finalPick.silver || ""
  };
});

standings.sort((a, b) => b.total - a.total || b.matchPoints - a.matchPoints || a.name.localeCompare(b.name, "fi"));

let previousTotal = null;
let currentRank = 0;
standings = standings.map((row, index) => {
  if (previousTotal === null || row.total !== previousTotal) {
    currentRank = index + 1;
    previousTotal = row.total;
  }
  return { rank: currentRank, ...row };
});

const output = {
  title: config.title,
  generatedAt: new Date().toISOString(),
  completedMatches: matches.filter(m => m.result).length,
  totalMatches: matches.length,
  standings,
  matches: matches.map(m => ({
    id: m.id,
    group: m.group,
    date: m.date,
    match: m.match,
    odds: m.odds,
    result: m.result,
    score: m.score,
    predictions: m.predictions
  }))
};

await fs.writeFile(DATA_PATH, JSON.stringify(output, null, 2), "utf8");
console.log(`Kirjoitettu ${DATA_PATH}: ${output.completedMatches}/${output.totalMatches} ottelua valmiina.`);
