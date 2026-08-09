// Typed JS wrapper around the CDP WebAssembly programs.
//
// Each CDP program is a standalone Emscripten module. This wrapper loads them
// on demand, stages input files into the in-memory filesystem (MEMFS), invokes
// the program's main() with command-line arguments, and reads the outputs back
// out — so callers work with byte arrays / AudioBuffers instead of touching the
// virtual filesystem. Works in Node, the browser and Web Workers.

import { decodeWav, decodeAiff, decodeAudio, encodeWav, wavToAudioBuffer, audioBufferToWav, floatWavIsSane } from './wav.js';

export { decodeWav, decodeAiff, decodeAudio, encodeWav, wavToAudioBuffer, audioBufferToWav, floatWavIsSane };
import { EFFECTS, programsFor } from './effects.js';
import { GENERATORS } from './generators.js';

export { EFFECTS, effectsByCategory, programsFor, buildArgs, paramRange, applyEffect, conformChannels, conformRate } from './effects.js';
export { GENERATORS, genById, applyGenerator } from './generators.js';
export { ENVELOPE_PARAMS } from './breakpoints.js';
export { extractEnvelope, warpBreakpoints, parseBreakpoints, formatBreakpoints, REPLOT_MODES } from './envelope.js';
export { getPitch, findPeaks } from './analysis.js';

/**
 * Every CDP program the typed catalog can invoke: each effect's program plus
 * the helpers it needs (pvoc for spectral effects, `needs:` extras, mixfile
 * renderers), and the generator programs. Derived from the catalog, so it can
 * never go stale. The *bundled* set is much larger — `cdp.programs()` lists it
 * from the build's manifest.json.
 */
export const PROGRAMS = [...new Set([
  ...EFFECTS.flatMap((e) => [...programsFor(e), ...(e.mixChain ? [e.mixChain.buildProgram, e.mixChain.renderProgram] : [])]),
  ...GENERATORS.map((g) => g.program),
])].sort();

export class CDP {
  /**
   * @param {object} [options]
   * @param {string|URL} [options.baseUrl] Directory containing the program
   *   .js/.wasm files. Defaults to the package's bundled `wasm/` folder.
   * @param {boolean} [options.simd] Force the SIMD (`true`) or scalar
   *   (`false`) variant of the FFT-bearing modules. Default: auto-detect the
   *   engine's SIMD support; the `<program>.scalar.*` fallbacks keep the
   *   package working on engines without SIMD128 (e.g. old webviews).
   */
  constructor(options = {}) {
    this._baseUrl = options.baseUrl
      ? new URL(String(options.baseUrl).replace(/\/?$/, '/'), selfUrl())
      : new URL('../wasm/', selfUrl());
    this._simd = options.simd;     // undefined = auto-detect
    this._factories = new Map();   // static layout: program -> factory
    this._layoutP = null;          // resolves to 'dynamic' | 'static'
    this._core = null;             // dynamic layout: the shared cdp-core factory
    this._manifestP = null;        // cached parsed manifest.json
  }

  /**
   * Which module variant to load for `program`: `'.scalar'` when the program
   * ships a SIMD build (per the manifest's `simd` list) but SIMD is disabled
   * or unsupported on this engine, else `''`.
   */
  async _variant(program) {
    const { simd } = await this._manifest().catch(() => ({ simd: [] }));
    if (!simd.includes(program)) return '';
    const want = this._simd !== undefined ? this._simd : engineHasSimd();
    return want ? '' : '.scalar';
  }

  /** Fetch + cache the build's manifest.json (program list + spectral tags). */
  async _manifest() {
    if (!this._manifestP) {
      this._manifestP = (async () => {
        const url = new URL('manifest.json', this._baseUrl);
        let text;
        if (url.protocol === 'file:') {
          // Node: fetch() can't read file:// — use fs.
          const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises');
          text = await readFile(url, 'utf8');
        } else {
          const res = await fetch(url.href);
          if (!res.ok) throw new Error(`manifest.json not found at ${url.href} (HTTP ${res.status})`);
          text = await res.text();
        }
        const m = JSON.parse(text);
        return Array.isArray(m)
          ? { programs: m, spectral: [], externals: [], simd: [] }
          : { programs: m.programs || [], spectral: m.spectral || [], externals: m.externals || [], simd: m.simd || [] };
      })();
    }
    return this._manifestP;
  }

  /**
   * List every CDP program bundled alongside the .wasm files (the full suite,
   * not just the typed catalog effects). Reads the build's `manifest.json`.
   * @returns {Promise<string[]>} sorted program names
   */
  async programs() {
    return (await this._manifest()).programs;
  }

  /**
   * The bundled programs that operate on PVOC *analysis* files (blur, morph,
   * formants, stretch, ...) rather than plain audio — i.e. those that need a
   * `pvoc anal` before and `pvoc synth` after. From `manifest.json`.
   * @returns {Promise<string[]>}
   */
  async spectralPrograms() {
    return (await this._manifest()).spectral;
  }

  /** Pre-load one or more program modules (otherwise loaded lazily on first run). */
  async load(...programs) {
    const { externals } = await this._manifest().catch(() => ({ externals: [] }));
    const dynamic = (await this._layout()) === 'dynamic'; // core is warmed by _layout()
    // Externals are always static modules; core programs only need preloading
    // under the static layout (the dynamic core is already warm).
    await Promise.all(programs.map(async (p) =>
      (externals.includes(p) || !dynamic)
        ? this._staticFactory(p + await this._variant(p).catch(() => ''))
        : null));
  }

  /**
   * Run a CDP program with raw command-line arguments.
   *
   * Use the placeholders that match files you pass in `inputs`/`outputs`; any
   * string in `args` is passed through verbatim, so reference virtual paths
   * directly, e.g. run('modify', ['speed','2','/in.wav','/out.wav','-12'], ...).
   *
   * @param {string} program  e.g. 'modify'
   * @param {string[]} args    command-line arguments (the program name is implicit)
   * @param {object} [io]
   * @param {Record<string,Uint8Array>} [io.inputs]  virtual path -> bytes written before the run
   * @param {string[]} [io.outputs]  virtual paths read back after the run
   * @param {{prefix:string, ext?:string}[]} [io.collect]  collect files whose
   *   count isn't known ahead of time: after the run, enumerate the directory and
   *   read back every file named `<prefix>.<ext>` or `<prefix><N>.<ext>` (N a
   *   number), sorted numerically. Used by multi-output programs (cantor,
   *   isolate, partition, ...) that write a generic outfile name → numbered files.
   * @returns {Promise<{exitCode:number, stdout:string, stderr:string, outputs:Record<string,Uint8Array>}>}
   */
  async run(program, args, io = {}) {
    // CDP writes 16-bit PCM unless the outfile name carries a '-f' prefix, which
    // handle_outfile() strips before opening the file and which switches the
    // output to 32-bit float. Ask for float on every declared WAV output, so a
    // chain of programs doesn't re-quantise at each step.
    //
    // Only the paths in `io.outputs` are rewritten. `io.collect` covers the
    // multi-output programs (randcuts, housekeep chans, …), which CDP classes as
    // NO_OUTPUTFILE and which never strip the flag — prefixing those would leave
    // the output at a path with the flag still in its name.
    const floatOut = new Set((io.outputs || []).filter((p) => p.toLowerCase().endsWith('.wav')));
    const argv = args.map((a) => (floatOut.has(a) ? '-f' + a : a));
    // Nothing asked for: no WAV output, or the outfile isn't named in `args`
    // (a program that derives numbered outputs from a stem, say).
    if (argv.every((a, i) => a === args[i])) return this._exec(program, argv, io);

    const res = await this._exec(program, argv, io);
    // Not every program understands the flag. Most that don't reject the
    // prefixed name outright: the portsf externals (reverb, fastconv, abfpan, …)
    // parse their own command line, and a few framework programs declare
    // NO_OUTPUTFILE and validate the name themselves (matrix, rejoin,
    // multisynth). A rarer kind accepts it and writes a float file whose samples
    // are still in the 16-bit integer domain (clicknew) — only the samples give
    // that away. Either way, fall back to a plain 16-bit run rather than lose the
    // program or hand back nonsense. Each _exec gets its own module instance, so
    // the retry starts from a clean filesystem.
    const produced = [...floatOut].filter((p) => res.outputs[p]);
    const usable = res.exitCode === 0 && produced.length > 0
      && produced.every((p) => floatWavIsSane(res.outputs[p]));
    return usable ? res : this._exec(program, args.slice(), io);
  }

  /** One run of `program` with a concrete argv, in a fresh module instance. */
  async _exec(program, argv, io = {}) {
    let stdout = '';
    let stderr = '';
    const Module = await this._instantiate(program, {
      noInitialRun: true,
      print: (s) => { stdout += s + '\n'; },
      printErr: (s) => { stderr += s + '\n'; },
    });

    for (const [path, data] of Object.entries(io.inputs || {})) {
      mkdirp(Module.FS, path);
      Module.FS.writeFile(path, data);
    }
    // Output directories must exist too — a program with no file inputs (a
    // generator like synth) otherwise has nowhere to create its output.
    for (const path of io.outputs || []) mkdirp(Module.FS, path);

    // Emscripten's callMain returns the program's exit status (CDP main()
    // returns 0 on success, negative on failure) and, in Node, can also set the
    // host process's exit code. Capture the status from the return value (or an
    // ExitStatus exception) and restore the host exit code so a failed CDP run
    // doesn't silently terminate the embedding process non-zero.
    const hostHadProcess = typeof process !== 'undefined';
    const prevHostExitCode = hostHadProcess ? process.exitCode : undefined;
    let exitCode = 0;
    try {
      // Emscripten's callMain unshifts argv[0] into the array it's given; run()
      // always hands over a fresh array, so the caller's own `args` stays intact.
      const status = Module.callMain(argv);
      if (typeof status === 'number') exitCode = status;
    } catch (e) {
      if (e && typeof e.status === 'number') exitCode = e.status;
      else {
        if (hostHadProcess) process.exitCode = prevHostExitCode;
        throw e;
      }
    }
    if (hostHadProcess) process.exitCode = prevHostExitCode;

    const outputs = {};
    for (const path of io.outputs || []) {
      try { outputs[path] = Module.FS.readFile(path); } catch { /* not produced */ }
    }
    // Content-driven multi-output: enumerate the directory and read every file
    // matching `<prefix>.<ext>` / `<prefix><N>.<ext>`, in numeric order.
    for (const { prefix, ext = 'wav' } of io.collect || []) {
      const slash = prefix.lastIndexOf('/');
      const dir = slash <= 0 ? '/' : prefix.slice(0, slash);
      const base = prefix.slice(slash + 1);
      const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${esc(base)}(\\d*)\\.${esc(ext)}$`);
      let names;
      try { names = Module.FS.readdir(dir); } catch { names = []; }
      names
        .map((n) => ({ n, m: re.exec(n) }))
        .filter((x) => x.m)
        .sort((a, b) => (a.m[1] === '' ? -1 : b.m[1] === '' ? 1 : Number(a.m[1]) - Number(b.m[1])))
        .forEach(({ n }) => {
          const full = dir === '/' ? `/${n}` : `${dir}/${n}`;
          if (full in outputs) return;
          try { outputs[full] = Module.FS.readFile(full); } catch { /* raced */ }
        });
    }
    return { exitCode, stdout, stderr, outputs };
  }

  /**
   * Convenience: run a program that transforms one input file into one output
   * file. `$IN` and `$OUT` in `args` are replaced with virtual paths.
   *
   * @param {string} program
   * @param {string[]} args   may contain the placeholders '$IN' and '$OUT'
   * @param {Uint8Array} inputBytes
   * @returns {Promise<{bytes:Uint8Array, stdout:string, stderr:string, exitCode:number}>}
   */
  async process(program, args, inputBytes, { inExt = 'wav', outExt = 'wav', channels, data, extraInputs } = {}) {
    // Channel handling for programs that only accept mono input. Works for any
    // channel count (stereo, quad, 8-channel, ...). Only meaningful for WAV in/out.
    if (channels && inExt === 'wav' && outExt === 'wav') {
      const dec = decodeAudio(inputBytes);
      if (dec.numChannels > 1) {
        if (channels === 'mix') inputBytes = mixToMono(dec);
        else if (channels === 'split') {
          const bytes = await this.eachChannel(inputBytes, (mono) =>
            this.process(program, args, mono, { inExt, outExt, data, extraInputs }).then((r) => r.bytes)
          );
          return { bytes, stdout: '', stderr: '', exitCode: 0 };
        }
      }
    }
    const inPath = `/in.${inExt}`;
    const outPath = `/out.${outExt}`;
    const dataPath = '/data.txt';
    // `extraInputs` stages additional files referenced verbatim in `args` (e.g.
    // per-parameter breakpoint-envelope files at /brk_<name>.brk).
    const inputs = { [inPath]: inputBytes, ...(extraInputs || {}) };
    // Optional generated text data file, referenced in args as '$DATA'.
    if (data != null) inputs[dataPath] = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const mapped = args.map((a) => (a === '$IN' ? inPath : a === '$OUT' ? outPath : a === '$DATA' ? dataPath : a));
    const res = await this.run(program, mapped, { inputs, outputs: [outPath] });
    const bytes = res.outputs[outPath];
    if (!bytes) {
      throw new Error(
        `${program} produced no output (exit ${res.exitCode}).\n${res.stderr || res.stdout}`.trim()
      );
    }
    return { bytes, stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
  }

  /**
   * Run a mono pipeline on every channel of a (possibly multichannel) WAV and
   * recombine the results, preserving the channel layout. This lets mono-only
   * CDP programs — and multi-step chains of them — keep stereo/quad/8-channel
   * width instead of being mixed down.
   *
   * @param {Uint8Array} wav  input WAV (any channel count)
   * @param {(monoWav:Uint8Array, channelIndex:number) => Promise<Uint8Array>|Uint8Array} fn
   *        receives one channel as a mono WAV and returns the processed mono WAV
   * @returns {Promise<Uint8Array>} the recombined multichannel WAV
   */
  async eachChannel(wav, fn) {
    const dec = decodeAudio(wav);
    if (dec.numChannels <= 1) return fn(wav, 0); // already mono: run once

    const outs = [];
    for (let c = 0; c < dec.numChannels; c++) {
      const monoWav = encodeWav({ sampleRate: dec.sampleRate, channelData: [dec.channelData[c]] });
      outs.push(decodeWav(await fn(monoWav, c)));
    }
    // Recombine. Per-channel outputs should be the same length; pad any short
    // channel with silence so an N-channel file always comes back out.
    const length = Math.max(...outs.map((o) => o.length));
    const channelData = outs.map((o) => {
      if (o.length === length) return o.channelData[0];
      const padded = new Float32Array(length);
      padded.set(o.channelData[0]);
      return padded;
    });
    return encodeWav({ sampleRate: outs[0].sampleRate, channelData });
  }

  /** Process a WAV byte array and decode the result to planar float channel data. */
  async processWav(program, args, inputWav) {
    const { bytes, stdout, stderr } = await this.process(program, args, inputWav);
    return { ...decodeWav(bytes), wav: bytes, stdout, stderr };
  }

  // Instantiate a ready-to-run Module for `program`, transparently handling both
  // bundle layouts:
  //   dynamic — one shared cdp-core (MAIN_MODULE) instantiated with the
  //     program's side module preloaded via Emscripten's `dynamicLibraries`, so
  //     libc + the CDP core ship once. (Default; see scripts/build-wasm.sh.)
  //   static  — a self-contained per-program module (the legacy layout).
  // The layout is detected once by probing for cdp-core.js next to the wasm.
  async _instantiate(program, opts) {
    // portsf-based externals (fast convolution, B-format, multichannel tools) are
    // self-contained static modules — load them standalone even under the dynamic
    // layout, since they don't live in the shared core.
    const { externals } = await this._manifest().catch(() => ({ externals: [] }));
    const variant = await this._variant(program).catch(() => '');
    if (!externals.includes(program) && (await this._layout()) === 'dynamic') {
      // The side module path is resolved relative to cdp-core.js by Emscripten's
      // loader, so a bare `<program>.wasm` is correct in Node and the browser.
      // The core's wasm is compiled once and cached (WebAssembly.Modules are
      // stateless); each run still gets a fresh Instance, so the no-shared-state
      // model is unchanged — only the read + compile are amortised.
      const coreModule = await this._coreWasmModule();
      return this._core({
        ...opts,
        dynamicLibraries: [`${program}${variant}.wasm`],
        instantiateWasm: (imports, done) => {
          WebAssembly.instantiate(coreModule, imports).then((inst) => done(inst, coreModule));
          return {};
        },
      });
    }
    const factory = await this._staticFactory(program + variant);
    return factory(opts);
  }

  /** Read + compile (once) the shared core's wasm; see _instantiate. */
  async _coreWasmModule() {
    if (!this._coreModP) {
      this._coreModP = (async () => {
        const url = new URL('cdp-core.wasm', this._baseUrl);
        let bytes;
        if (url.protocol === 'file:') {
          const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises');
          bytes = await readFile(url);
        } else {
          const res = await fetch(url.href);
          if (!res.ok) throw new Error(`fetch ${url.href}: HTTP ${res.status}`);
          bytes = new Uint8Array(await res.arrayBuffer());
        }
        return WebAssembly.compile(bytes);
      })();
    }
    return this._coreModP;
  }

  /** Detect (once) and cache which bundle layout is present. */
  async _layout() {
    if (!this._layoutP) {
      this._layoutP = (async () => {
        try {
          const url = new URL('cdp-core.js', this._baseUrl).href;
          const mod = await import(/* @vite-ignore */ url);
          this._core = mod.default;
          return 'dynamic';
        } catch {
          return 'static';
        }
      })();
    }
    return this._layoutP;
  }

  async _staticFactory(program) {
    if (!this._factories.has(program)) {
      const url = new URL(`${program}.js`, this._baseUrl).href;
      const mod = await import(/* @vite-ignore */ url);
      this._factories.set(program, mod.default);
    }
    return this._factories.get(program);
  }
}

function mixToMono({ sampleRate, numChannels, length, channelData }) {
  const mono = new Float32Array(length);
  for (let c = 0; c < numChannels; c++) {
    const ch = channelData[c];
    for (let i = 0; i < length; i++) mono[i] += ch[i] / numChannels;
  }
  return encodeWav({ sampleRate, channelData: [mono] });
}

function mkdirp(FS, filePath) {
  const parts = filePath.split('/').slice(1, -1);
  let cur = '';
  for (const p of parts) {
    cur += '/' + p;
    try { FS.mkdir(cur); } catch { /* exists */ }
  }
}

function selfUrl() {
  // import.meta.url in module scope; works in Node and browsers.
  return import.meta.url;
}

// Does this engine support WASM SIMD128? Probed once by validating a minimal
// module containing one SIMD instruction (the wasm-feature-detect approach):
// engines without the feature reject it at validation, by spec. Used to pick
// the `<program>.scalar.*` fallbacks on e.g. old webviews.
let _simdSupport;
function engineHasSimd() {
  if (_simdSupport === undefined) {
    try {
      _simdSupport = WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
        10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ]));
    } catch {
      _simdSupport = false;
    }
  }
  return _simdSupport;
}
