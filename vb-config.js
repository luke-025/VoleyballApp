// vb-config.js
// Paste your Supabase anon key below:
// Supabase Dashboard -> Project Settings -> API -> Project API keys -> anon (public)

window.VB_CONFIG = {
  SUPABASE_URL: 'https://cdsuicldkalaahjrlwhf.supabase.co',
  SUPABASE_ANON_KEY: 'PASTE_ANON_KEY_HERE',

  // Used when URL does not include ?t=...
  DEFAULT_TOURNAMENT_SLUG: 'default',

  // UI labels (PL)
  STAGES: [
    { key: 'group', label: 'Grupa' },
    { key: 'quarterfinal', label: 'Ćwierćfinał' },
    { key: 'semifinal', label: 'Półfinał' },
    { key: 'thirdplace', label: 'Mecz o 3 miejsce' },
    { key: 'final', label: 'Finał' },
  ],

  GROUPS: ['A', 'B', 'C', 'D'],
};
