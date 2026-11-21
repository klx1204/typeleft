import { $view } from '@milkdown/kit/utils';
import katex from 'katex';
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';
import loadRenderer from 'services/renderers';
import { t } from 'services/i18n';

const DIAGRAM_LANGS = ['mermaid', 'flowchart', 'sequence', 'plantuml', 'vega-lite', 'vega'] as const;
type DiagramLang = typeof DIAGRAM_LANGS[number];

export const isDiagramLang = (lang: string): lang is DiagramLang =>
  (DIAGRAM_LANGS as readonly string[]).includes(lang);

/** `math` fences render through KaTeX as a display formula (#39). */
export const isPreviewLang = (lang: string): boolean => isDiagramLang(lang) || lang === 'math';

/** Render a fenced diagram into `target`, matching the Muya renderer behaviour. */
export const renderDiagram = async (
  target: HTMLElement,
  lang: DiagramLang,
  code: string,
  options: any = {}
): Promise<void> => {
  const dark = (window as any).actualTheme === 'dark';
  try {
    if ((lang as string) === 'math') {
      katex.render(code || '\\phantom{x}', target, {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: false,
      });
      return;
    }
    if (lang === 'mermaid') {
      const mermaid = await loadRenderer('mermaid');
      mermaid.initialize({
        securityLevel: 'strict',
        theme: options.mermaidTheme || (dark ? 'dark' : 'default'),
      });
      mermaid.parse(code);
      target.textContent = code;
      // mermaid 8 marks rendered nodes with data-processed and would skip them
      // when the preview is toggled off and on again.
      target.removeAttribute('data-processed');
      mermaid.init(undefined, target);
      return;
    }
    if (lang === 'vega' || lang === 'vega-lite') {
      const embed = await loadRenderer('vega-lite');
      const spec = JSON.parse(code);
      const host = document.createElement('div');
      target.appendChild(host);
      await embed(host, spec, {
        actions: false,
        tooltip: false,
        renderer: 'svg',
        theme: options.vegaTheme || (dark ? 'dark' : 'latimes'),
      });
      return;
    }
    const renderer = await loadRenderer(lang as 'flowchart' | 'sequence' | 'plantuml');
    const diagram = renderer.parse(code);
    if (lang === 'plantuml') {
      diagram.insertImgElement(target);
    } else {
      diagram.drawSVG(target, lang === 'sequence' ? { theme: options.sequenceTheme } : {});
    }
  } catch (err) {
    target.textContent = '< Invalid diagram >';
    target.classList.add('diagram-error');
  }
};

const LANGUAGE_LIST = [
  '', 'text', 'bash', 'sh', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'html',
  'java', 'javascript', 'js', 'json', 'jsx', 'kotlin', 'latex', 'lua', 'markdown',
  'php', 'python', 'py', 'r', 'ruby', 'rb', 'rust', 'scss', 'shell', 'sql', 'swift',
  'toml', 'ts', 'tsx', 'typescript', 'xml', 'yaml', 'yml', 'mermaid', 'flowchart',
  'sequence', 'plantuml', 'vega', 'vega-lite', 'math', 'graphql', 'dockerfile', 'makefile',
  'objectivec', 'perl', 'powershell', 'scala', 'haskell', 'elixir', 'dart', 'vue',
];

/** Keep unknown languages selectable instead of silently resetting to text. */
const languageOptions = (current: string): string[] => {
  const list = [...LANGUAGE_LIST];
  if (current && !list.includes(current)) list.splice(1, 0, current);
  return list;
};

export const createCodeBlockView = $view(codeBlockSchema.node, () => (node, view, getPos) => {
  let currentNode = node;
  let timer: number | undefined;
  let destroyed = false;

  const dom = document.createElement('div');
  dom.className = 'md-fences-wrapper';
  dom.setAttribute('data-language', node.attrs.language ?? '');

  const header = document.createElement('div');
  header.className = 'md-fences-header';

  const select = document.createElement('select');
  select.className = 'md-fences-language';
  const fillSelect = (current: string) => {
    select.innerHTML = '';
    for (const lang of languageOptions(current)) {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang || t('Text');
      select.appendChild(option);
    }
    select.value = current || '';
  };
  fillSelect(node.attrs.language || '');

  const actions = document.createElement('div');
  actions.className = 'md-fences-actions';

  const wrapBtn = document.createElement('button');
  wrapBtn.type = 'button';
  wrapBtn.textContent = '↩';
  wrapBtn.title = 'Toggle line wrap';
  wrapBtn.addEventListener('click', () => {
    dom.classList.toggle('wrap');
  });

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.textContent = '◉';
  previewBtn.title = 'Toggle preview';
  let previewEnabled = true;
  previewBtn.addEventListener('click', () => {
    previewEnabled = !previewEnabled;
    previewBtn.classList.toggle('active', previewEnabled);
    if (!previewEnabled) {
      preview.textContent = '';
      preview.classList.remove('active');
    } else {
      schedulePreview();
    }
  });

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '⧉';
  copyBtn.title = t('Copy');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(currentNode.textContent).catch(() => {});
  });

  actions.appendChild(previewBtn);
  actions.appendChild(wrapBtn);
  actions.appendChild(copyBtn);
  header.appendChild(select);
  header.appendChild(actions);

  const body = document.createElement('div');
  body.className = 'md-fences-body';

  const gutter = document.createElement('div');
  gutter.className = 'md-fences-gutter';

  const pre = document.createElement('pre');
  pre.className = 'md-fences';
  const code = document.createElement('code');
  code.className = 'md-fences-content';
  pre.appendChild(code);
  body.appendChild(gutter);
  body.appendChild(pre);

  const updateGutter = () => {
    const lines = currentNode.textContent.split('\n').length;
    if (gutter.childElementCount === lines) return;
    gutter.innerHTML = '';
    for (let i = 1; i <= lines; i += 1) {
      const line = document.createElement('div');
      line.textContent = String(i);
      gutter.appendChild(line);
    }
  };

  const preview = document.createElement('div');
  preview.className = 'diagram-preview';

  dom.appendChild(header);
  dom.appendChild(body);
  dom.appendChild(preview);

  const schedulePreview = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (destroyed) return;
      const language = currentNode.attrs.language ?? '';
      const renderable = previewEnabled && isPreviewLang(language);
      preview.classList.toggle('active', renderable);
      if (!renderable) {
        preview.textContent = '';
        preview.classList.remove('diagram-error');
        return;
      }
      preview.textContent = '';
      preview.classList.remove('diagram-error');
      renderDiagram(preview, language as any, currentNode.textContent, (window as any).typeleftEditorOptions ?? {});
    }, 400);
  };

  select.addEventListener('change', () => {
    const pos = typeof getPos === 'function' ? getPos() : undefined;
    if (typeof pos !== 'number') return;
    const language = select.value;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, language }));
    dom.setAttribute('data-language', language);
  });

  schedulePreview();
  updateGutter();

  return {
    dom,
    contentDOM: code,
    update(next) {
      if (next.type !== currentNode.type) return false;
      const languageChanged = next.attrs.language !== currentNode.attrs.language;
      currentNode = next;
      if (languageChanged) {
        fillSelect(next.attrs.language || '');
        dom.setAttribute('data-language', next.attrs.language || '');
      }
      schedulePreview();
      updateGutter();
      return true;
    },
    destroy() {
      destroyed = true;
      if (timer) window.clearTimeout(timer);
    },
    ignoreMutation(mutation) {
      if (mutation.type === 'selection') return false;
      const target = mutation.target as HTMLElement;
      return !code.contains(target);
    },
    stopEvent(event) {
      const target = event.target as HTMLElement;
      return !!target.closest('.md-fences-header') || !!target.closest('.diagram-preview');
    },
  };
});
