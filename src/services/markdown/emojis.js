import emojis from './emojisJson.json'

/** Look up an emoji by shortcode (used by the HTML exporter). */
export const validEmoji = text => emojis.find(emoji => emoji.aliases.includes(text))
