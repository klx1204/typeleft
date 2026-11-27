import transport from 'services/transport';
import { remote } from 'services/remote';

let themeMode = 'system';

function getOrCreateLink(id: string): HTMLLinkElement {
  let el = document.getElementById(id) as HTMLLinkElement;
  if (!el) {
    el = document.createElement("link");
    el.rel = "stylesheet";
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

function applyTheme(theme: string) {
  const editorStyle = getOrCreateLink("link_style_editor");
  const prismjsStyle = getOrCreateLink("link_style_prismjs");
  const codemirrorStyle = getOrCreateLink("link_style_codemirror");

  const t = theme?.toLowerCase() || 'light';
  editorStyle.href = `theme/editor/${t}.theme.css`;
  prismjsStyle.href = `theme/prismjs/${t}.theme.css`;
  codemirrorStyle.href = `theme/codemirror/${t}.theme.css`;

  const isDark = t === 'dark';
  // WebKitGTK paints the unfocused part of native <select> with the light UA
  // style unless the document advertises a dark color scheme. GTK theme does
  // not affect it, so keep the page color-scheme in sync with the app theme.
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  const r = 68, g = 138, b = 255, a = 1;
  const bgR = isDark ? 30 : 255, bgG = isDark ? 30 : 255, bgB = isDark ? 30 : 255, bgA = 255;

  document.documentElement.style.setProperty('--app-bg-color-base', `rgba(${bgR}, ${bgG}, ${bgB}, ${bgA})`);
  document.body.style.backgroundColor = 'var(--app-bg-color, var(--app-bg-color-base))';
  document.documentElement.style.setProperty('--actualTheme', t);
  document.documentElement.style.setProperty('--themeColor', `rgba(${r}, ${g}, ${b}, ${a})`);
  [10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(e =>
    document.documentElement.style.setProperty(`--themeColor${e}`, `rgba(${r}, ${g}, ${b}, ${a * (e / 100)})`));
  window.actualTheme = t;
}

function onThemeChanged(payload: any) {
  const theme = typeof payload === 'string' ? payload : payload?.theme || 'light';
  applyTheme(theme);
}

transport.addListener('ThemeChanged', (payload: any) => {
  if (themeMode === 'system') {
    onThemeChanged(payload);
  }
});

transport.addListener('SettingsChanged', (payload: any) => {
  if (payload.themeMode) {
    themeMode = payload.themeMode;
    if (payload.themeMode === 'system') {
      remote.getCurrentTheme().then(arg => onThemeChanged(arg));
    } else {
      applyTheme(payload.themeMode);
    }
  }
});

remote.getCurrentTheme().then((arg: any) => {
  const theme = typeof arg === 'string' ? arg : arg?.theme || 'light';
  applyTheme(theme);
  remote.getSettings().then((settings: any) => {
    if (settings?.themeMode && settings.themeMode !== 'system') {
      themeMode = settings.themeMode;
      applyTheme(settings.themeMode);
    }
  }).catch(() => {});
}).catch(() => {
  applyTheme('light');
});
