/* Dev-only Tauri stub so the real React components can run in a plain browser.
 * Loaded before any module, it implements the small part of the Tauri IPC the
 * editor components use (event bus, settings, content loading). */
(function () {
  var listeners = new Map();
  var callbacks = new Map();
  var nextId = 1;
  var emitted = [];
  var clipboard = { text: '', html: null };

  var settings = {
    autoSave: false,
    fontSize: 16,
    lineHeight: 1.6,
    editorAreaWidth: '860px',
    bulletListMarker: '-',
    lang: 'zh',
    sourceCode: false,
    pinnedFolders: ['/tmp/notes'],
  };

  var fixture = document.documentElement.getAttribute('data-fixture') === 'empty' ? '' : null;

  var exportConfigs = [
    { id: 'a', name: 'HTML', exportType: 'html', fileName: 'a.html', outputDir: '', includeCss: true, includeFrontmatter: false, includeToc: true, postAction: 'none' },
    { id: 'b', name: 'Print', exportType: 'html', fileName: 'b.html', outputDir: '', includeCss: false, includeFrontmatter: true, includeToc: false, postAction: 'none' },
  ];

  // Marked so services can tell the stub IPC apart from a real Tauri webview.
  window.__DEV_STUB__ = true;

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    },
    transformCallback: function (cb, once) {
      var id = nextId++;
      var wrapped = once
        ? function () {
            callbacks.delete(id);
            delete window['_' + id];
            return cb.apply(null, arguments);
          }
        : cb;
      callbacks.set(id, wrapped);
      window['_' + id] = wrapped;
      return id;
    },
    convertFileSrc: function (path) {
      return 'asset://localhost/' + encodeURIComponent(path);
    },
    invoke: function (cmd, args) {
      args = args || {};
      if (cmd === 'plugin:event|listen') {
        var set = listeners.get(args.event) || new Set();
        set.add(args.handler);
        listeners.set(args.event, set);
        return Promise.resolve(nextId++);
      }
      if (cmd === 'plugin:event|unlisten') {
        listeners.get(args.event) && listeners.get(args.event).delete(args.handler);
        return Promise.resolve(null);
      }
      if (cmd === 'plugin:event|emit' || cmd === 'plugin:event|emit_to') {
        emitted.push({ event: args.event, payload: args.payload });
        var handlers = Array.from(listeners.get(args.event) || []);
        handlers.forEach(function (id) {
          var cb = callbacks.get(id) || window['_' + id];
          if (cb) {
            try {
              cb({ event: args.event, id: id, payload: args.payload });
            } catch (err) {
              window.__errors.push('listener error: ' + String(err));
            }
          }
        });
        return Promise.resolve(null);
      }
      if (cmd === 'get_settings') return Promise.resolve(settings);
      if (cmd === 'content_loaded') {
        return Promise.resolve({ text: window.__FIXTURE__ || '', base_path: '', file_path: '/tmp/fixture.md' });
      }
      if (cmd === 'get_current_theme') return Promise.resolve('dark');
      if (cmd === 'list_recent_folders') return Promise.resolve(['/tmp/recent-notes']);
      if (cmd === 'get_export_configs') return Promise.resolve(exportConfigs);
      if (cmd === 'reorder_export_configs') { window.__reordered = args.ids; return Promise.resolve(null); }
      if (cmd === 'get_settings_path') return Promise.resolve('/tmp/typeleft/settings.json');
      if (cmd === 'get_log_path') return Promise.resolve('/tmp/typeleft/typeleft_errors.log');
      if (cmd === 'read_log') return Promise.resolve('[Typeleft] test log line\n');
      if (cmd === 'open_url') { window.__openedUrl = args.url; return Promise.resolve(null); }
      if (cmd === 'list_directory') return Promise.resolve([]);
      if (cmd === 'get_file_mtime') return Promise.resolve(1700000000000);
      if (cmd === 'latest_backup') return Promise.resolve(null);
      if (cmd === 'get_theme_dir') return Promise.resolve('/devtest/');
      if (cmd === 'list_themes') return Promise.resolve(['typora-theme.css']);
      if (cmd === 'theme_file_exists') return Promise.resolve(false);
      if (cmd === 'read_theme_file') {
        return Promise.resolve(window.__THEME_CSS__ || '');
      }
      if (cmd === 'set_clipboard_rich') {
        clipboard.text = args.text || '';
        clipboard.html = args.html || null;
        window.__clipboard = clipboard;
        return Promise.resolve(true);
      }
      if (cmd === 'set_clipboard') {
        clipboard.text = typeof args.data === 'string' ? args.data : '';
        clipboard.html = null;
        window.__clipboard = clipboard;
        return Promise.resolve(true);
      }
      if (cmd === 'get_clipboard_html') return Promise.resolve(clipboard.html);
      if (cmd === 'get_clipboard_text') return Promise.resolve(clipboard.text);
      return Promise.resolve(null);
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    registerListener: function () {},
    unregisterListener: function () {},
  };
  window.__emitted = emitted;
  window.__emit = function (event, payload) {
    return window.__TAURI_INTERNALS__.invoke('plugin:event|emit', { event: event, payload: payload });
  };
  window.__errors = [];
  window.addEventListener('error', function (event) {
    window.__errors.push('window.error: ' + (event.message || event.type));
  });
  window.addEventListener('unhandledrejection', function (event) {
    window.__errors.push('unhandledrejection: ' + String(event.reason));
  });
  var originalError = console.error.bind(console);
  console.error = function () {
    window.__errors.push(Array.prototype.map.call(arguments, function (a) { return a && a.stack ? String(a.stack) : String(a); }).join(' '));
    originalError.apply(null, arguments);
  };
  if (fixture !== null) window.__FIXTURE__ = fixture;

  // Mirror services/theme.ts, which sets these at runtime in the real app.
  var rootStyle = document.documentElement.style;
  rootStyle.setProperty('--themeColor', 'rgba(68, 138, 255, 1)');
  [10, 20, 30, 40, 50, 60, 70, 80, 90].forEach(function (e) {
    rootStyle.setProperty('--themeColor' + e, 'rgba(68, 138, 255, ' + e / 100 + ')');
  });
  window.actualTheme = 'dark';
})();
