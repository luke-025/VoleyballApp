// vb-ui-shared.js

window.VB_UI = {
  stageLabel(stageKey) {
    const s = (window.VB_CONFIG?.STAGES || []).find(x => x.key === stageKey);
    return s ? s.label : stageKey;
  },

  getTournamentSlug() {
    const params = new URLSearchParams(window.location.search);
    return params.get('t') || window.VB_CONFIG.DEFAULT_TOURNAMENT_SLUG;
  },

  // Basic HTML escaping for names
  esc(str) {
    return String(str ?? '').replace(/[&<>"]/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c]));
  },

  nowIso() {
    return new Date().toISOString();
  },
};
