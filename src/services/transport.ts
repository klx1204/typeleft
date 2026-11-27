import { invoke } from '@tauri-apps/api/core'
import { listen, emit } from '@tauri-apps/api/event'

type Listener<T> = (arg: T) => void;

const registry = new Map<string, Set<Listener<any>>>();
const unlisteners = new Map<string, () => void>();

const ensureListener = async (event: string) => {
  if (unlisteners.has(event)) return
  try {
    const unlisten = await listen(event, (e) => {
      registry.get(event)?.forEach(fn => fn(e.payload))
    })
    unlisteners.set(event, unlisten)
  } catch {
    // Not running inside a Tauri webview (unit tests, plain browser): keep the
    // local registry so components can still register/unregister handlers.
  }
}

const remoteFunction = <T, TResult>(name: string) =>
  (args?: T): Promise<TResult> =>
    invoke<TResult>(name, args ?? undefined)

/**
 * For commands whose single Rust argument is itself a map/struct (for example
 * `fn save_settings(settings: HashMap<...>)`), Tauri still expects the payload
 * to be keyed by the argument name. Passing the object directly makes Tauri
 * reject the call with `missing required key <name>`.
 */
const remoteFunctionWithArgKey = <T, TResult>(name: string, argKey: string) =>
  (arg: T): Promise<TResult> =>
    invoke<TResult>(name, { [argKey]: arg })

const postMessage = (name: string, args: unknown) => {
  // `emit` throws or rejects outside Tauri (unit tests, plain browser).
  try {
    void emit(name, args).catch(() => {})
  } catch {
    /* ignore */
  }
}

export default {
  addListener: <T>(eventName: string, listener: Listener<T>) => {
    if (!registry.has(eventName)) {
      registry.set(eventName, new Set())
      ensureListener(eventName)
    }
    registry.get(eventName)!.add(listener)
    return () => { registry.get(eventName)?.delete(listener) }
  },
  removeListener: <T>(eventName: string, listener: Listener<T>) => {
    registry.get(eventName)?.delete(listener)
  },
  removeAllListener: (eventName: string) => {
    registry.get(eventName)?.clear()
  },
  postMessageNoDiff: postMessage,
  postMessage,
}

export { remoteFunction, remoteFunctionWithArgKey }
