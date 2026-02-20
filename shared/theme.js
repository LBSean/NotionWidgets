// shared/theme.js — initialise and toggle light/dark theme
// Include in <head> (synchronous, no defer) to avoid flash of wrong theme.
(function () {
  var KEY = 'widget-theme';
  var stored = localStorage.getItem(KEY);
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = stored ? stored === 'dark' : prefersDark;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';

  window.__toggleTheme = function () {
    var nowDark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = nowDark ? 'light' : 'dark';
    try { localStorage.setItem(KEY, nowDark ? 'light' : 'dark'); } catch (e) {}
  };
}());
