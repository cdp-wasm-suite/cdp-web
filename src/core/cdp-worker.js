// Dedicated worker hosting the CDP engine. callMain runs synchronously, so a
// render on the main thread freezes the UI for its whole duration — here it
// only blocks this worker. The engine is stateless per call (every run() gets
// a fresh Emscripten instance) and DOM-free, so a plain method-RPC suffices.
//
// Workers don't see the page's import map, so the engine is imported by path —
// the same file the map points at (vendored under node_modules/ in the built
// site too). It resolves its .wasm assets relative to its own src/, which works
// identically here.
//
// Protocol: { id, method, args } in → { id, result } | { id, error } out.
// Result Uint8Arrays (rendered WAV/.ana bytes) are transferred, not copied;
// inputs arrive cloned so callers keep their buffers.
import { CDP } from '../../node_modules/cdp-wasm/src/index.js';

const cdp = new CDP();

// Every Uint8Array buffer inside a result, deduped — the transfer list.
const collectBuffers = (v, out = new Set()) => {
  if (v instanceof Uint8Array) out.add(v.buffer);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) collectBuffers(v[k], out);
  return out;
};

self.onmessage = async (e) => {
  const { id, method, args } = e.data;
  try {
    const result = await cdp[method](...args);
    postMessage({ id, result }, [...collectBuffers(result)]);
  } catch (ex) {
    postMessage({ id, error: String(ex?.message || ex) });
  }
};
