// Dedicated worker hosting the Faust compiler AND the offline render loop.
// libfaust compiles synchronously and rendering computes audio block-by-block —
// on the main thread either one freezes the UI (a big DSP for seconds), so both
// happen here. Compile replies carry only the compiled factory (wasm module +
// JSON, structured-cloneable); render replies transfer the output channels.
//
// Workers don't see the page's import map, so the faustwasm bundle is imported
// by path — the same file the map points at (vendored under node_modules/ in
// the built site too).
//
// Protocol: { id, op: 'compile'|'render', ... } in →
//   compile: { id, factory } | render: { id, channels }
//   errors:  { id, error, compileError? , opError? } — compileError marks bad
//   DSP code, opError a failed operation on good infrastructure; neither set
//   means infrastructure failure (the caller falls back to inline compile).
import { renderInstance, extractParams } from './faust-render.js';

let libP = null;
const lib = () => (libP ||= import(new URL('../../node_modules/@grame/faustwasm/dist/esm-bundle/index.js', import.meta.url).href));
let compilerP = null;
const getCompiler = () => (compilerP ||= lib().then(async ({ instantiateFaustModule, LibFaust, FaustCompiler }) =>
  new FaustCompiler(new LibFaust(await instantiateFaustModule()))));

// code → { gen, addresses, params }, mirroring the main thread's factory cache.
const _entries = new Map();
async function ensureCompiled(code) {
  if (_entries.has(code)) return _entries.get(code);
  const compiler = await getCompiler();
  const { FaustMonoDspGenerator } = await lib();
  const gen = new FaustMonoDspGenerator();
  let ok = null, err = null;
  try { ok = await gen.compile(compiler, 'dsp', code, ''); } catch (ex) { err = ex; }
  if (!ok) throw Object.assign(new Error(err?.message || compiler.getErrorMessage() || 'Faust compile error'), { compileError: true });
  const entry = { gen, ...extractParams(JSON.parse(gen.factory.json).ui) };
  _entries.set(code, entry);
  return entry;
}

self.onmessage = async (e) => {
  const { id, op, code } = e.data;
  try {
    if (op === 'render') {
      const { sr, frames, values, mod, inputChannels } = e.data;
      const entry = await ensureCompiled(code);
      let channels;
      try { channels = await renderInstance(entry.gen, sr, frames, entry.addresses, entry.params, values, mod, inputChannels); }
      catch (ex) { throw Object.assign(ex instanceof Error ? ex : new Error(String(ex)), { opError: true }); }
      postMessage({ id, channels }, channels.map((c) => c.buffer));
    } else {
      const entry = await ensureCompiled(code);
      postMessage({ id, factory: entry.gen.factory });   // wasm Module + json are structured-cloneable
    }
  } catch (ex) {
    postMessage({ id, error: String(ex?.message || ex), compileError: !!ex?.compileError, opError: !!ex?.opError });
  }
};
