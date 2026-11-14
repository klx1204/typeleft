import snapUrl from '../../../../assets/libs/snap.svg-min.js?url'

const rendererCache = new Map()

// sequence-diagram-snap expects Snap.svg to be present as a global (`eve`).
// Load it as a plain script before the renderer module executes.
const ensureSnapSvg = () => new Promise((resolve, reject) => {
  if (typeof window !== 'undefined' && window.eve) {
    return resolve()
  }
  const script = document.createElement('script')
  script.src = snapUrl
  script.onload = () => resolve()
  script.onerror = () => reject(new Error('failed to load snap.svg'))
  document.head.appendChild(script)
})
/**
 *
 * @param {string} name the renderer name: katex, sequence, plantuml, flowchart, mermaid, vega-lite
 */
const loadRenderer = async (name) => {
  if (!rendererCache.has(name)) {
    let m
    switch (name) {
      case 'sequence':
        await ensureSnapSvg()
        m = await import('../parser/render/sequence')
        rendererCache.set(name, m.default)
        break
      case 'plantuml':
        m = await import('../parser/render/plantuml')
        rendererCache.set(name, m.default)
        break
      case 'flowchart':
        m = await import('flowchart.js')
        rendererCache.set(name, m.default)
        break
      case 'mermaid':
        m = await import('mermaid/dist/mermaid.core.js')
        rendererCache.set(name, m.default)
        break
      case 'vega-lite':
        m = await import('vega-embed')
        rendererCache.set(name, m.default)
        break
      default:
        throw new Error(`Unknown diagram name ${name}`)
    }
  }

  return rendererCache.get(name)
}

export default loadRenderer
