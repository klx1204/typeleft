/**
 * Normalize Pandoc/Typora LaTeX delimiters before markdown parsing.
 *
 * Micromark treats `\(` and `\[` as escaped punctuation, so a remark plugin
 * cannot see them. We rewrite them to `$...$` / `$$...$$` outside fenced code
 * blocks first. The serializer then uses the canonical dollar form.
 */
export const normalizeLatexDelimiters = (markdown: string): string => {
  if (!markdown || (!markdown.includes('\\(') && !markdown.includes('\\['))) return markdown;

  const lines = markdown.split('\n');
  let inFence = false;
  let buffer: string[] = [];
  const output: string[] = [];

  const flush = () => {
    if (!buffer.length) return;
    let text = buffer.join('\n');
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `$$\n${body.trim()}\n$$`);
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$${body.trim()}$`);
    output.push(text);
    buffer = [];
  };

  for (const line of lines) {
    const fence = /^\s*(```|~~~)/.test(line);
    if (fence) {
      flush();
      output.push(line);
      inFence = !inFence;
    } else if (inFence) {
      output.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return output.join('\n');
};
