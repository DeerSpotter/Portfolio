const THEME_STORAGE_KEY = 'portfolio-theme';
const PAPER_THEME = 'paper';
const MILITARY_THEME = 'military';
const VALID_THEMES = new Set([PAPER_THEME, MILITARY_THEME]);

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return VALID_THEMES.has(stored) ? stored : PAPER_THEME;
  } catch {
    return PAPER_THEME;
  }
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in privacy-restricted contexts. Theme switching
    // still works for the current page without treating persistence as required.
  }
}

function ensureThemeStylesheet() {
  if (document.getElementById('portfolioThemeStyles')) return;
  const link = document.createElement('link');
  link.id = 'portfolioThemeStyles';
  link.rel = 'stylesheet';
  link.href = new URL('./theme.css', import.meta.url).href;
  document.head.append(link);
}

function ensureToggle() {
  const existing = document.getElementById('themeToggle');
  if (existing) return existing;

  const header = document.querySelector('.hud-top');
  if (!header) throw new Error('Theme toggle requires the HUD header.');

  const button = document.createElement('button');
  button.id = 'themeToggle';
  button.className = 'theme-toggle';
  button.type = 'button';
  button.innerHTML = '<span class="theme-toggle-dot" aria-hidden="true"></span><span class="theme-toggle-label">THEME</span><strong class="theme-toggle-value">FIELD</strong>';
  header.append(button);
  return button;
}

function updateThemeMetadata(theme) {
  const military = theme === MILITARY_THEME;
  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.content = military ? 'dark' : 'light';
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = military ? '#0d130f' : '#e7d8b8';
}

ensureThemeStylesheet();
const toggle = ensureToggle();
let activeTheme = readStoredTheme();

function publishDebug() {
  window.__portfolioThemeDebug = {
    ready: true,
    theme: activeTheme,
    storageKey: THEME_STORAGE_KEY,
    toggleMounted: Boolean(toggle?.isConnected),
    placement: 'hud-top-right',
    reparenting: false,
  };
}

function applyTheme(theme, { persist = true, announce = true } = {}) {
  activeTheme = VALID_THEMES.has(theme) ? theme : PAPER_THEME;
  const military = activeTheme === MILITARY_THEME;
  document.documentElement.dataset.theme = activeTheme;
  document.documentElement.style.colorScheme = military ? 'dark' : 'light';
  updateThemeMetadata(activeTheme);

  toggle.setAttribute('aria-pressed', String(military));
  toggle.setAttribute('aria-label', military
    ? 'Switch to paper theme'
    : 'Switch to military dark theme');
  toggle.title = military ? 'Switch to paper theme' : 'Switch to military dark theme';
  toggle.querySelector('.theme-toggle-value').textContent = military ? 'PAPER' : 'FIELD';
  toggle.dataset.themeTarget = military ? PAPER_THEME : MILITARY_THEME;

  if (persist) persistTheme(activeTheme);
  publishDebug();

  if (announce) {
    window.dispatchEvent(new CustomEvent('portfolio-theme-change', {
      detail: { theme: activeTheme },
    }));
  }
}

toggle.addEventListener('click', () => {
  applyTheme(activeTheme === MILITARY_THEME ? PAPER_THEME : MILITARY_THEME);
});

applyTheme(activeTheme, { persist: false, announce: false });
