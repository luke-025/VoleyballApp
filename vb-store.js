// vb-store.js
// Supabase-backed store with realtime subscription.

window.VB_Store = (() => {
  let client = null;
  let tournamentSlug = null;
  let tournamentId = null;
  let currentVersion = null;
  let currentState = null;
  let channel = null;

  function assertConfig() {
    if (!window.VB_CONFIG) throw new Error('VB_CONFIG missing (include vb-config.js)');
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.VB_CONFIG;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'PASTE_ANON_KEY_HERE') {
      throw new Error('Supabase anon key missing: set VB_CONFIG.SUPABASE_ANON_KEY');
    }
  }

  function init() {
    assertConfig();
    if (client) return client;
    client = window.supabase.createClient(window.VB_CONFIG.SUPABASE_URL, window.VB_CONFIG.SUPABASE_ANON_KEY);
    return client;
  }

  function getDeviceId() {
    const key = 'vb_device_id';
    let v = localStorage.getItem(key);
    if (!v) {
      v = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, v);
    }
    return v;
  }

  function getPin(slug) {
    return sessionStorage.getItem('vb_pin_' + slug) || '';
  }

  function setPin(slug, pin) {
    sessionStorage.setItem('vb_pin_' + slug, pin);
  }

  async function ensureTournament(slug, pin, initialState) {
    init();
    const { data: id, error } = await client.rpc('vb_create_tournament', {
      p_slug: slug,
      p_pin: pin,
      p_initial_state: initialState ?? null,
    });
    if (error) {
      // If slug exists, ignore.
      if (!String(error.message || '').toLowerCase().includes('slug already exists')) {
        throw error;
      }
    }
    return id;
  }

  async function resolveTournamentId(slug) {
    init();
    const { data, error } = await client.rpc('vb_get_tournament_id', { p_slug: slug });
    if (error) throw error;
    if (!data) throw new Error(`Tournament not found for slug: ${slug}`);
    return data;
  }

  async function loadState(slug) {
    init();
    tournamentSlug = slug;
    tournamentId = await resolveTournamentId(slug);

    const { data, error } = await client
      .from('tournament_state')
      .select('state, version, updated_at')
      .eq('tournament_id', tournamentId)
      .single();

    if (error) throw error;

    currentVersion = data.version;
    currentState = window.VB_Rules.ensureStateShape(data.state || {});
    return { state: currentState, version: currentVersion };
  }

  async function updateState(newState) {
    init();
    if (!tournamentSlug) throw new Error('Call loadState(slug) first');
    const pin = getPin(tournamentSlug);
    if (!pin) throw new Error('PIN not set in session (prompt user and call setPin)');

    const payload = window.VB_Rules.ensureStateShape(newState);

    const { data, error } = await client.rpc('vb_update_state', {
      p_slug: tournamentSlug,
      p_pin: pin,
      p_new_state: payload,
      p_expected_version: currentVersion,
    });
    if (error) throw error;

    // vb_update_state returns a single-row table
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('No response from vb_update_state');

    if (!row.ok) {
      // Conflict or wrong pin; in both cases server returns latest (conflict) or null
      if (row.version >= 0 && row.state) {
        currentVersion = row.version;
        currentState = window.VB_Rules.ensureStateShape(row.state);
        return { ok: false, conflict: true, state: currentState, version: currentVersion };
      }
      return { ok: false, conflict: false, state: null, version: -1 };
    }

    currentVersion = row.version;
    currentState = window.VB_Rules.ensureStateShape(row.state);
    return { ok: true, state: currentState, version: currentVersion };
  }

  function subscribe(onChange) {
    init();
    if (!tournamentId) throw new Error('Call loadState(slug) first');

    // clean previous
    if (channel) {
      client.removeChannel(channel);
      channel = null;
    }

    channel = client
      .channel('vb_state_' + tournamentId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournament_state', filter: `tournament_id=eq.${tournamentId}` },
        (payload) => {
          const next = payload.new;
          if (!next) return;
          currentVersion = next.version;
          currentState = window.VB_Rules.ensureStateShape(next.state || {});
          onChange?.({ state: currentState, version: currentVersion });
        }
      )
      .subscribe();

    return () => {
      try { client.removeChannel(channel); } catch (_) {}
      channel = null;
    };
  }

  return {
    init,
    getDeviceId,
    getPin,
    setPin,
    ensureTournament,
    loadState,
    updateState,
    subscribe,
    getCurrent() {
      return { state: currentState, version: currentVersion, slug: tournamentSlug, id: tournamentId };
    }
  };
})();
