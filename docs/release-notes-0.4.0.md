Typeleft 0.4.0 changes what happens with very large documents.

## Large documents now open in source mode

Previously anything above 200K characters was handed to the legacy Muya engine.
From this release the document opens in the CodeMirror 6 source editor instead,
which is virtualised and stays responsive even for multi-megabyte files, with a
notice bar at the top. Press **Shift+F** to force rich text for the current file
if you prefer (it can be slow), or pick the **Muya** engine in Settings.

## Fixes in this release

- A 1 MB file used to spend ~25 s on load: React rendered the rich-text editor
  for one frame before the size check kicked in, and ProseMirror parsed the whole
  document. The size decision now happens before the editor mounts, and the
  rich-text component refuses documents above the limit.
- Removed two per-document IPC messages (`MarkdownChange`, `FileLoaded`) that had
  no listeners but shipped the whole document to the backend on every load and
  every edit.
- The outline is capped at 500 headings, so huge documents no longer push
  thousands of entries into the sidebar.

## Why

ProseMirror renders the whole document at once: parsing plus DOM construction
takes ~4.7 s at 450K characters and ~15 s at 900K. Virtualising it would mean
reimplementing a large part of the editor view (selection, IME, decorations,
drag and drop), so the source editor is the safer path. Muya stays bundled and
selectable manually, but nothing chooses it automatically any more.

## Everything else

0.2.x/0.3.0 fixes and features are included: menu commands, slash menu, Typora
theme surfaces, CodeMirror 6 theming, highlight/superscript/subscript, image
alignment and resizing.
