module.exports = {
  event: {
    name: "Softball 2026",
    status: "LIVE"
  },
  match: {
    gameId: "",
    inning: 1,
    half: "TOP",
    outs: 0,
    balls: 0,
    strikes: 0,
    regulationInnings: 7,
    tiebreakInning: 0,
    autoTiebreak: true,
    bases: { first: false, second: false, third: false },
    teams: {
      away: { name: "Visitante", short: "VIS", color: "#1f9d55", logo: "", score: 0, hits: 0, errors: 0, line: [] },
      home: { name: "Local", short: "LOC", color: "#62b5e5", logo: "", score: 0, hits: 0, errors: 0, line: [] }
    }
  },
  theme: {
    ink: "#10151b",
    panel: "#17222c",
    teal: "#00a78e",
    mint: "#9df1d7",
    coral: "#ff4f5e",
    gold: "#ffc83d",
    paper: "#f7f3ea",
    white: "#ffffff"
  },
  scoreboard: { title: "LINE SCORE", subtitle: "Softball 2026" },
  matchup: { title: "MATCHUP", subtitle: "Softball 2026", round: "Fase de grupos", venue: "", titleScale: 1 },
  rosters: { title: "TEAM ROSTER", subtitle: "Softball 2026", away: { playersText: "" }, home: { playersText: "" } },
  umpires: { title: "OFFICIALS", subtitle: "Softball 2026", crewText: "HP  Umpire Principal  Plate\n1B  Umpire Primera  First Base\n3B  Umpire Tercera  Third Base" },
  player: { title: "PLAYER", subtitle: "Softball 2026", teamSide: "home", number: "", name: "", detail: "" },
  commentators: { title: "COMMENTATORS", subtitle: "Softball 2026", layout: "two", name1: "", role1: "Relator", name2: "", role2: "Comentarista" },
  ndi: {
    sourceName: "B5 Scorebug",
    width: 1920,
    height: 1080,
    fps: 30,
    alpha: true,
    activeGraphic: "scorebug",
    visible: false,
    scorebugVisible: false,
    playerVisible: false
  }
};
