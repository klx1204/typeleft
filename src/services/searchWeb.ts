const DEFAULT_TEMPLATE = 'https://www.google.com/search?q=%s';

/** Build the URL used by the selected-text web search (#165). */
export const buildSearchUrl = (text: string, template?: string): string => {
  const value = (template || '').trim() || DEFAULT_TEMPLATE;
  const encoded = encodeURIComponent(text.trim());
  return value.includes('%s') ? value.replace('%s', encoded) : `${value}${encoded}`;
};
