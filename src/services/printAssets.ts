import remote from 'services/remote/common';
import loadRenderer from 'services/renderers';
import { isDiagramLang, renderDiagram, type DiagramLang } from 'components/MilkdownEditor/nodes/codeblock';

const DIAGRAM_FENCE = /^```([a-z][\w-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;

const svgToPng = (svg: SVGSVGElement, scale = 2): Promise<string> => new Promise((resolve, reject) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const width = Math.max(320, Math.ceil(rect.width || 800));
  const height = Math.max(160, Math.ceil(rect.height || 600));
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('canvas-unavailable')); return; }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    resolve(canvas.toDataURL('image/png').split(',')[1] || '');
  };
  image.onerror = () => reject(new Error('svg-image-decode-failed'));
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
});

const renderMermaid = async (target: HTMLElement, code: string, options: any): Promise<void> => {
  const mermaid = await loadRenderer('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: options?.mermaidTheme || 'default',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  });
  await mermaid.parse(code);
  const id = `tl-print-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { svg } = await mermaid.render(id, code);
  target.innerHTML = svg;
};

export interface PreRenderResult {
  markdown: string;
  rendered: number;
  failed: string[];
}

/**
 * Replace diagram fences with PNG assets before handing Markdown to Pandoc.
 * ExportHtml already pre-renders diagrams for HTML/print; this path covers
 * LaTeX/WeasyPrint where the engine only sees Markdown.
 */
export const preRenderDiagrams = async (markdown: string, options: any = {}): Promise<PreRenderResult> => {
  const matches = Array.from(markdown.matchAll(DIAGRAM_FENCE));
  if (!matches.length) return { markdown, rendered: 0, failed: [] };
  let output = markdown;
  let rendered = 0;
  const failed: string[] = [];
  for (const match of matches) {
    const language = match[1];
    if (!isDiagramLang(language)) continue;
    const code = match[2];
    if (!code.trim()) continue;
    if (language === 'plantuml') {
      failed.push('plantuml: requires the PlantUML server');
      continue;
    }
    const target = document.createElement('div');
    target.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff';
    document.body.appendChild(target);
    try {
      if (language === 'mermaid') await renderMermaid(target, code, options);
      else await renderDiagram(target, language as DiagramLang, code, options);
      const svg = target.querySelector('svg') as SVGSVGElement | null;
      if (!svg) {
        failed.push(`${language}: no SVG output`);
        continue;
      }
      const data = await svgToPng(svg);
      const path = await remote.savePrintAsset({ data, extension: 'png' });
      const replacement = `![${language} diagram](${path.replace(/\\/g, '/')})`;
      output = output.replace(match[0], replacement);
      rendered += 1;
    } catch (err: any) {
      failed.push(`${language}: ${String(err)}`);
    } finally {
      target.remove();
    }
  }
  return { markdown: output, rendered, failed };
};
