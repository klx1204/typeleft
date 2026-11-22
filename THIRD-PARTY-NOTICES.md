# Third-party notices

Typeleft is distributed under the **GNU General Public License v3.0 or later**
(`GPL-3.0-or-later`). See [LICENSE](LICENSE).

Some files are derived from earlier MIT/BSD/Apache-licensed projects. Those
portions remain under their original licenses; the notices below must be kept
in source and binary distributions.

## Typedown

Typeleft is a cross-platform rewrite based on Typedown. The original project is
MIT-licensed:

```
MIT License

Copyright (c) 2022 ZZF

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## MarkText / Muya

Parts of the Markdown/export/import/diagram pipeline are derived from Muya in
MarkText:

```
MIT License

Copyright (c) 2017-present Luo Ran
Copyright (c) 2018-present MarkText Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## marked

`src/services/markdown/marked/` is a fork of marked:

```
Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)

MIT License. The full text is in src/services/markdown/marked/LICENSE.
```

## Django urlify

`src/services/markdown/marked/urlify.js` is derived from Django:

```
Copyright (c) Django Software Foundation and individual contributors.
All rights reserved.

BSD 3-Clause License. Redistribution and use in source and binary forms, with
or without modification, are permitted provided that the copyright notice,
this list of conditions and the following disclaimer are retained. Neither the
name of Django nor the names of its contributors may be used to endorse or
promote products derived from this software without specific prior written
permission.
```

## Snap.svg

`src/assets/libs/snap.svg-min.js` is Snap.svg 0.5.1:

```
Copyright (c) 2013-2017 Adobe Systems Incorporated. All rights reserved.
Licensed under the Apache License, Version 2.0. The full text is in
src/assets/libs/LICENSE-Snap.svg.
```

## js-sequence-diagrams

`src/assets/libs/sequence-diagram-snap.js` is js-sequence-diagrams 2.0.1:

```
Copyright (c) 2012-2017 Andrew Brampton (bramp.net)
Simplified BSD License. The full text is in
src/assets/libs/LICENSE-sequence-diagram-snap.txt.
```

## English dictionary

`src/assets/spell/` contains dictionary-en (MIT AND BSD). The full notice and
upstream credits are in [src/assets/spell/LICENSE](src/assets/spell/LICENSE).

## Emoji data

`src/services/markdown/emojisJson.json` is generated from emojibase-data:

```
MIT License

Copyright (c) 2017-2019 Miles Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Bundled runtime dependencies

The application bundle includes open-source npm/Rust dependencies, including:

| Dependency | License |
|---|---|
| React / React DOM | MIT |
| Tauri | MIT OR Apache-2.0 |
| Milkdown / ProseMirror | MIT |
| CodeMirror 6 | MIT |
| remark / unified / mdast utilities | MIT |
| KaTeX | MIT |
| Mermaid | MIT |
| Vega / Vega-Lite / Vega-Embed | BSD-3-Clause |
| Prism | MIT |
| DOMPurify | MPL-2.0 OR Apache-2.0 |
| nspell | MIT |
| emojibase-data | MIT |

Their full license texts are retained in the corresponding packages and in the
release source tree. A complete dependency-license report is generated before
each release.

## Themes

Theme CSS files are independent works. Their authors may license them
separately; the GPL applies to Typeleft itself and to themes only when they are
distributed as part of a Typeleft distribution.
