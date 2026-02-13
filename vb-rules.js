// vb-rules.js
// Pure-ish tournament rules + state helpers.

window.VB_Rules = (() => {
  const GROUPS_FALLBACK = ['A','B','C','D'];

  const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2));

  function ensureStateShape(state) {
    const s = state && typeof state === 'object' ? state : {};
    if (!s.meta) s.meta = {};
    if (!s.meta.createdAt) s.meta.createdAt = new Date().toISOString();
    if (!Array.isArray(s.teams)) s.teams = [];
    if (!Array.isArray(s.matches)) s.matches = [];
    if (!s.programMatchId) s.programMatchId = null;
    if (!s.courts || typeof s.courts !== 'object') s.courts = {};
    return s;
  }

  function isTieBreak(setIndex) {
    return setIndex === 2;
  }

  function minPointsForSet(setIndex) {
    return isTieBreak(setIndex) ? 15 : 25;
  }

  function isSetFinished(set, setIndex) {
    const minPoints = minPointsForSet(setIndex);
    const a = set.a ?? 0;
    const b = set.b ?? 0;
    return (a >= minPoints && a - b >= 2) || (b >= minPoints && b - a >= 2);
  }

  function currentSetIndex(match) {
    for (let i = 0; i < (match.sets?.length || 0); i++) {
      if (!isSetFinished(match.sets[i], i)) return i;
    }
    return Math.max(0, (match.sets?.length || 1) - 1);
  }

  function recomputeMatchSummary(match) {
    let aSets = 0;
    let bSets = 0;

    (match.sets || []).forEach((set, idx) => {
      const minPoints = minPointsForSet(idx);
      const a = set.a ?? 0;
      const b = set.b ?? 0;
      if (a >= minPoints && a - b >= 2) aSets += 1;
      if (b >= minPoints && b - a >= 2) bSets += 1;
    });

    match.aSets = aSets;
    match.bSets = bSets;

    if (aSets >= 2 || bSets >= 2) {
      match.status = 'finished';
      match.winner = aSets > bSets ? 'A' : 'B';
    } else {
      // If someone is editing finished match via admin, keep finished.
      if (match.status !== 'live') match.status = 'live';
      match.winner = null;
    }
    return match;
  }

  function createMatch({ stage, group = null, team1Id, team2Id }) {
    return recomputeMatchSummary({
      id: uid(),
      stage,
      group,
      team1Id,
      team2Id,
      createdAt: new Date().toISOString(),
      status: 'pending',
      winner: null,
      confirmed: false, // only meaningful for stage==='group'
      claimedBy: null,
      claimedAt: null,
      sets: [{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }],
      aSets: 0,
      bSets: 0,
    });
  }

  function canScore(match) {
    return match.status !== 'finished' && match.status !== 'confirmed';
  }

  function applyPoint(match, side, delta) {
    if (!canScore(match)) return match;

    const idx = currentSetIndex(match);
    const set = match.sets[idx];
    if (side === 'A') set.a = Math.max(0, (set.a ?? 0) + delta);
    if (side === 'B') set.b = Math.max(0, (set.b ?? 0) + delta);

    // Auto-finish set based on rules.
    if (isSetFinished(set, idx)) {
      // nothing special to store per-set; summary is derived
    }

    // If match already has 2 sets, mark finished and block further scoring.
    recomputeMatchSummary(match);

    // If match not finished, keep it live when scoring starts.
    if (match.status === 'pending') match.status = 'live';

    return match;
  }

  function confirmMatch(match) {
    if (match.stage !== 'group') return match;
    // Only confirm if finished
    if (match.status !== 'finished') return match;
    match.confirmed = true;
    match.status = 'confirmed';
    return match;
  }

  function unconfirmMatch(match) {
    if (match.stage !== 'group') return match;
    if (match.status !== 'confirmed') return match;
    match.status = 'finished';
    match.confirmed = false;
    return match;
  }

  function claimMatch(match, deviceId) {
    const now = new Date().toISOString();
    if (match.claimedBy && match.claimedBy !== deviceId) {
      return { ok: false, match };
    }
    match.claimedBy = deviceId;
    match.claimedAt = now;
    if (match.status === 'pending') match.status = 'live';
    return { ok: true, match };
  }

  function releaseMatch(match, deviceId) {
    if (match.claimedBy && match.claimedBy !== deviceId) {
      return { ok: false, match };
    }
    match.claimedBy = null;
    match.claimedAt = null;
    return { ok: true, match };
  }

  function getGroupsFromTeams(teams) {
    const set = new Set();
    for (const t of teams || []) {
      if (t.group) set.add(t.group);
    }
    const arr = [...set];
    if (arr.length) return arr.sort();
    return GROUPS_FALLBACK;
  }

  // Standings for a group, computed ONLY from stage==='group' and status==='confirmed'
  function computeStandings(group, teams, matches) {
    const groupTeams = (teams || []).filter(t => t.group === group);
    const stats = new Map();

    for (const team of groupTeams) {
      stats.set(team.id, {
        teamId: team.id,
        name: team.name,
        group: team.group,
        matches: 0,
        points: 0,
        setsWon: 0,
        setsLost: 0,
        smallWon: 0,
        smallLost: 0,
      });
    }

    const relevant = (matches || []).filter(m => m.stage === 'group' && m.group === group && m.status === 'confirmed');

    for (const m of relevant) {
      const a = stats.get(m.team1Id);
      const b = stats.get(m.team2Id);
      if (!a || !b) continue;

      a.matches += 1; b.matches += 1;
      a.setsWon += m.aSets; a.setsLost += m.bSets;
      b.setsWon += m.bSets; b.setsLost += m.aSets;

      // small points
      for (const set of m.sets || []) {
        a.smallWon += set.a ?? 0;
        a.smallLost += set.b ?? 0;
        b.smallWon += set.b ?? 0;
        b.smallLost += set.a ?? 0;
      }

      // tournament points 3-2-1-0
      const aSets = m.aSets;
      const bSets = m.bSets;
      if (aSets === 2 && bSets === 0) { a.points += 3; b.points += 0; }
      else if (bSets === 2 && aSets === 0) { b.points += 3; a.points += 0; }
      else if (aSets === 2 && bSets === 1) { a.points += 2; b.points += 1; }
      else if (bSets === 2 && aSets === 1) { b.points += 2; a.points += 1; }
    }

    const arr = [...stats.values()].map(s => {
      const setDiff = s.setsWon - s.setsLost;
      const ratio = s.smallLost > 0 ? s.smallWon / s.smallLost : s.smallWon;
      return { ...s, setDiff, ratio };
    });

    arr.sort((x, y) => {
      if (y.points !== x.points) return y.points - x.points;
      if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
      return y.ratio - x.ratio;
    });

    return arr;
  }

  return {
    ensureStateShape,
    createMatch,
    applyPoint,
    recomputeMatchSummary,
    currentSetIndex,
    isSetFinished,
    minPointsForSet,
    confirmMatch,
    unconfirmMatch,
    claimMatch,
    releaseMatch,
    getGroupsFromTeams,
    computeStandings,
  };
})();
