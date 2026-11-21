Typeleft 0.6.0 removes the legacy editor engine.

## Muya is gone

The Muya editor and its UI are deleted. Typeleft now has exactly two editing
modes: the Milkdown WYSIWYG editor and the CodeMirror 6 source editor. The
**Editor Engine** setting is gone, and documents above 200K characters still
open in source mode automatically.

The parts of Muya that the HTML export/import pipeline and the diagram previews
used were moved to `src/services/` first (a marked fork, sanitize/turndown
helpers, the renderer loader and the sequence/plantuml renderers), so export and
print behave as before.

Build size: `dist` 9.4 MB → 7.1 MB, main JS chunk 2.8 MB → 2.38 MB. Muya-only
dependencies (file icons, popper, fuzzaldrin, html-tags, element-resize-detector,
path-browserify) were removed.

## Localisation

Every string added in 0.5.0 is now translated: the empty-paragraph hint, the
emoji/table pickers, the link popover, the footnote placeholder, the table and
image toolbars, the frontmatter warning and the slash-menu labels.

## CI

A `Test` workflow runs on every push to `main` and on pull requests:

- engine / source-mode decision
- markdown round-trip fixtures
- CodeMirror 6 smoke test
- search / replace tests
- the headless-Chrome suite that mounts the real editor components

Remaining work (clipboard real-machine checks, Vega automation, cursor reverse
mapping, and so on) is tracked in `docs/todo.md`.
