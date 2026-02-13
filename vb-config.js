// vb-config.js
// Paste your Supabase anon key below:
// Supabase Dashboard -> Project Settings -> API -> Project API keys -> anon (public)

window.VB_CONFIG = {
  SUPABASE_URL: 'https://cdsuicldkalaahjrlwhf.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkc3VpY2xka2FsYWFoanJsd2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTUzNTksImV4cCI6MjA4NjU5MTM1OX0.iT05FX6rqT_3gcl_9hYg3iBwnrc1doDmxU2oRwzhOcs',

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
