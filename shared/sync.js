// shared/sync.js — shared sync utilities for NotionWidgets
// Include after config.js: <script src="../../shared/sync.js"></script>
(function () {
  'use strict';

  /* ── HTTP helper ──────────────────────────────────────────── */
  function post(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  /* ── Indicator ────────────────────────────────────────────── */
  function updateIndicator(el, state, hasUrl) {
    if (!el) return;
    if (!hasUrl)   { el.className = 'sync-ind'; el.textContent = ''; return; }
    if (state === 'syncing') { el.className = 'sync-ind syncing'; el.textContent = '\u21BB'; }
    else if (state === 'synced') { el.className = 'sync-ind synced'; el.textContent = '\u2713'; }
    else if (state === 'error')  { el.className = 'sync-ind error';  el.textContent = '!'; }
    else { el.className = 'sync-ind'; el.textContent = ''; }
  }

  /* ── init() — create a sync context for a widget ──────────── */
  function init(opts) {
    var name = opts.name;
    var key  = opts.key || name;
    var indEl = typeof opts.indicatorEl === 'string'
      ? document.querySelector(opts.indicatorEl) : (opts.indicatorEl || null);
    var debounceMs = opts.debounce != null ? opts.debounce : 500;
    var _timer = null;

    var ctx = {
      url: localStorage.getItem(name + '-sync-url')
        || (typeof SYNC_URL !== 'undefined' ? SYNC_URL : '') || '',
      state: 'idle',

      saveUrl: function (url) {
        ctx.url = url;
        localStorage.setItem(name + '-sync-url', url);
      },

      setState: function (s) {
        ctx.state = s;
        updateIndicator(indEl, s, !!ctx.url);
        if (s === 'synced') setTimeout(function () {
          if (ctx.state === 'synced') { ctx.state = 'idle'; updateIndicator(indEl, 'idle', !!ctx.url); }
        }, 2000);
      },

      /* POST config-load, return data or null */
      pull: async function () {
        if (!ctx.url) return null;
        ctx.setState('syncing');
        try {
          var json = await post(ctx.url, { action: 'config-load', key: key });
          ctx.setState('synced');
          if (json.ok && json.data) return json.data;
          return null;
        } catch (e) { ctx.setState('error'); return null; }
      },

      /* POST config-save, immediate */
      pushNow: async function (data) {
        if (!ctx.url) return;
        ctx.setState('syncing');
        try {
          await post(ctx.url, { action: 'config-save', key: key, data: data });
          ctx.setState('synced');
        } catch (e) { ctx.setState('error'); }
      },

      /* POST config-save, debounced */
      push: function (data) {
        if (!ctx.url) return;
        clearTimeout(_timer);
        _timer = setTimeout(function () { ctx.pushNow(data); }, debounceMs);
      },

      /* Arbitrary POST (for sticky CRUD, heatmap habits, etc.) */
      send: async function (payload) {
        if (!ctx.url) return null;
        ctx.setState('syncing');
        try {
          var json = await post(ctx.url, payload);
          ctx.setState('synced');
          return json;
        } catch (e) { ctx.setState('error'); return null; }
      },
    };

    updateIndicator(indEl, 'idle', !!ctx.url);
    return ctx;
  }

  /* ── resolve() — smart conflict resolution ────────────────── */
  function resolve(local, remote, isDefault) {
    var localCustom  = !isDefault(local);
    var remoteCustom = !isDefault(remote);

    if (localCustom && !remoteCustom) return { action: 'use-local' };
    if (!localCustom && remoteCustom) return { action: 'use-remote' };

    var lt = (local  && local.lastModified)  || 0;
    var rt = (remote && remote.lastModified) || 0;
    if (rt > lt) return { action: 'use-remote' };
    if (lt > rt) return { action: 'use-local' };
    return { action: 'equal' };
  }

  /* ── testConnection() — test a worker URL ─────────────────── */
  async function testConnection(url, payload) {
    if (!url) return { ok: false, message: 'Enter a URL first' };
    try {
      var json = await post(url, payload);
      if (json.ok) return { ok: true, message: '\u2713 Connected' + (json.data ? ' \u2014 data found' : ' \u2014 no data yet') };
      return { ok: false, message: '\u2717 ' + (json.error || 'Error') };
    } catch (e) { return { ok: false, message: '\u2717 ' + e.message }; }
  }

  /* ── Export ────────────────────────────────────────────────── */
  window.WidgetSync = {
    init: init,
    resolve: resolve,
    testConnection: testConnection,
  };
}());
