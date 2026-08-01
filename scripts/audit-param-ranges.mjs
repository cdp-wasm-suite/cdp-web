// audit-param-ranges.mjs — validate catalog parameter ranges against the live
// CDP engine. Hand-authored ranges in cdp-wasm (EFFECTS in
// catalog.js, GENERATORS in generators.js) declare min/max/default/step per
// parameter; the UI clamps sliders to these, so a wrong range is exactly how a
// value CDP rejects reaches the engine. This headless Node harness probes every
// numeric parameter's edges (and just outside them) against the real WASM
// programs and classifies the mismatches.
//
//   npm run audit:ranges                 # full audit, diffed against the baseline
//   node scripts/audit-param-ranges.mjs --effect modify.speed --verbose
//   node scripts/audit-param-ranges.mjs --self-test
//   node scripts/audit-param-ranges.mjs --update-baseline
//
// It is an audit, not a gate: `npm test` stays fast and deterministic. The audit
// is slower (thousands of WASM runs) and its findings are triaged into a
// checked-in baseline so only *new* mismatches stand out.

import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import os from 'node:os';
import v8 from 'node:v8';
import vm from 'node:vm';
import {
  CDP, EFFECTS, GENERATORS, applyEffect, applyGenerator, decodeWav, paramRange,
} from 'cdp-wasm';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF_URL = new URL(import.meta.url);

// Bump to invalidate every cache entry (protocol / classification changes).
const PROTOCOL_VERSION = 7;

const BASELINE_PATH = resolve(HERE, 'param-ranges.baseline.json');
const CACHE_PATH = resolve(HERE, '..', '.cache', 'param-ranges-cache.json');
const DEFAULT_OUT = resolve(HERE, '..', 'param-ranges-report.json');

// Primary probe source is 1 s mono; retries use these alternates to tell a
// duration-dependent constraint (delay ≥ source length, etc.) from a real
// range bug.
const PRIMARY_SECONDS = 1;
const ALT_SECONDS = [4, 0.4];

// A CDP sub-run that "produced no output (exit N)" is the engine *rejecting* the
// arguments — the signal we probe for. Anything else thrown is a harness bug.
const REJECT_RE = /produced no (?:output|mixfile) \(exit/;
// CDP usually names the bound it wanted: "Parameter[3] Value (50.0) out of
// range (2.0 to 16.0)". Parsing it tells us the engine's real limit — and
// re-probing at another duration tells us whether that limit is a fixed
// property of the program or just the source length (see diagnoseRejection).
const BOUND_RE = /out of range \((-?[\d.]+) to (-?[\d.]+)\)/;
const parseBound = (msg) => { const m = BOUND_RE.exec(String(msg || '')); return m ? { lo: Number(m[1]), hi: Number(m[2]) } : null; };
const sameBound = (a, b) => a && b && Math.abs(a.lo - b.lo) < 1e-6 && Math.abs(a.hi - b.hi) < 1e-6;
// stderr that betrays CDP silently fixing an out-of-range value on an accepted run.
const CLAMP_RE = /warning|out of range|adjusted|clamp|too (?:large|small)|must be/i;

// tier per finding kind — errors are real range bugs, advisories are informational.
const TIER = {
  OVER_WIDE_MIN: 'error', OVER_WIDE_MAX: 'error',
  BAD_DEFAULT: 'error', BASELINE_FAIL: 'error', PROBE_ERROR: 'error',
  RANGE_HOLE: 'warn', INPUT_DEPENDENT: 'warn', CONTENT_DEPENDENT: 'warn',
  OVER_NARROW_MIN: 'advisory', OVER_NARROW_MAX: 'advisory',
};

// ---------------------------------------------------------------------------
// Test-signal synthesis — ported from cdp-wasm/test/catalog.mjs, but with a
// controllable duration so the same shapes can be re-run at 4 s / 0.4 s. All
// probes use a mono source (nch = 1); the alternates only vary the length.
// ---------------------------------------------------------------------------
const SR = 44100;

function tone(seconds) {
  const N = Math.round(seconds * SR);
  const a = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    a[i] = 0.4 * Math.sin((2 * Math.PI * 220 * i) / SR) * (0.5 + 0.5 * Math.sin((2 * Math.PI * 3 * i) / SR));
  }
  return wav(a);
}
function grainy(seconds) {
  const N = Math.round(seconds * SR);
  const a = new Float32Array(N);
  // Enveloped 330 Hz bursts every 7000 samples, each up to 3500 long — scaled
  // to fill whatever duration is requested (test/catalog.mjs fixes this at 1 s).
  for (let s = 0; s + 1 < N; s += 7000) {
    const len = Math.min(3500, N - s);
    for (let i = 0; i < len; i++) a[s + i] = 0.5 * Math.sin((2 * Math.PI * 330 * i) / SR) * Math.sin((Math.PI * i) / len);
  }
  return wav(a);
}
function harmonic(seconds) {
  const N = Math.round(seconds * SR);
  const a = new Float32Array(N);
  const f0 = 220;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let h = 1; h * f0 < 12000; h++) s += Math.sin((2 * Math.PI * h * f0 * i) / SR) / h;
    a[i] = 0.35 * s * (2 / Math.PI);
  }
  return wav(a);
}
function tone2(seconds) {
  const N = Math.round(seconds * SR);
  const a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = 0.4 * Math.sin((2 * Math.PI * 165 * i) / SR);
  return wav(a);
}

// Retry-only signals. The three above are deliberately tame, which makes many
// programs complain about the *material* rather than the parameter ("No pitch
// found", "NO PEAKS IN THE FILE", "Entire signal would be gated"). These four
// supply the features those programs look for — full-scale level, sharp
// transients, a high fundamental, a moving pitch — so a probe that fails on all
// seven is failing on its own merits, not for want of suitable audio.
let _lcg = 12345;
const rnd = () => { _lcg = (Math.imul(_lcg, 1664525) + 1013904223) >>> 0; return (_lcg / 4294967296) * 2 - 1; };
function loudnoise(seconds) {
  _lcg = 12345; // reseed: probes must be reproducible
  const N = Math.round(seconds * SR); const a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = rnd() * 0.99;
  return wav(a);
}
function transients(seconds) {
  _lcg = 12345;
  const N = Math.round(seconds * SR); const a = new Float32Array(N);
  const n = Math.max(4, Math.round(20 * seconds));
  for (let g = 0; g < n; g++) {
    const s = Math.floor((g * N) / n);
    for (let i = 0; i < 800 && s + i < N; i++) a[s + i] = 0.99 * Math.exp(-i / 120) * rnd();
  }
  return wav(a);
}
function hipitch(seconds) {
  const N = Math.round(seconds * SR); const a = new Float32Array(N);
  for (let i = 0; i < N; i++) { let v = 0; for (let h = 1; h * 1200 < 20000; h++) v += Math.sin((2 * Math.PI * h * 1200 * i) / SR) / h; a[i] = 0.6 * v; }
  return wav(a);
}
function vibrato(seconds) {
  const N = Math.round(seconds * SR); const a = new Float32Array(N);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const f = 330 * (1 + 0.06 * Math.sin((2 * Math.PI * 5 * i) / SR));
    ph += (2 * Math.PI * f) / SR;
    let v = 0; for (let h = 1; h <= 8; h++) v += Math.sin(h * ph) / h;
    a[i] = 0.6 * v;
  }
  return wav(a);
}
function wav(mono) {
  // encodeWav lives behind the package; build a minimal PCM16 WAV directly so we
  // don't depend on more of the engine surface than we probe.
  const N = mono.length;
  const buf = new ArrayBuffer(44 + N * 2);
  const dv = new DataView(buf);
  const wStr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wStr(0, 'RIFF'); dv.setUint32(4, 36 + N * 2, true); wStr(8, 'WAVE');
  wStr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wStr(36, 'data'); dv.setUint32(40, N * 2, true);
  for (let i = 0; i < N; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

// Memoise synthesized sources — deterministic, so a handful of shapes/durations
// are reused across thousands of probes.
const _srcCache = new Map();
const SYNTHS = { tone, harmonic, grainy, loudnoise, transients, hipitch, vibrato };
function synth(kind, seconds) {
  const key = `${kind}:${seconds}`;
  if (!_srcCache.has(key)) _srcCache.set(key, (SYNTHS[kind] || tone)(seconds));
  return _srcCache.get(key);
}
function sourceKind(effect) {
  return effect.prefersHarmonic ? 'harmonic' : effect.prefersGrains ? 'grainy' : 'tone';
}

// The (src, extra) pair an effect needs at a given duration, mirroring
// test/catalog.mjs's per-effect source selection. `kind` overrides that choice
// so a rejected probe can be retried on differently-featured audio.
function sourceFor(effect, seconds, kind) {
  const src = synth(kind || sourceKind(effect), seconds);
  const extra = {};
  // On a retry the override applies to every input: a two-input program such as
  // specross analyses both, and leaving the second as a plain tone would keep it
  // reporting "No pitch found in source 2" no matter what the first input is.
  const second = kind ? synth(kind, seconds) : tone2(seconds);
  if (effect.inputs >= 2) extra.in2 = second;
  if (effect.variadicInputs || effect.mixChain?.multiInput) extra.inputs = [second, synth(kind || 'tone', seconds)];
  return { src, extra };
}
const ALL_KINDS = ['tone', 'harmonic', 'grainy', 'loudnoise', 'transients', 'hipitch', 'vibrato'];

// ---------------------------------------------------------------------------
// Telemetry — wrap cdp.run once so every sub-invocation of a single applyEffect
// records its program / exit / stderr tail (index.js: process() → run()).
// ---------------------------------------------------------------------------
function instrument(cdp) {
  const calls = [];
  const orig = cdp.run.bind(cdp);
  cdp.run = async (program, args, io) => {
    const res = await orig(program, args, io);
    calls.push({ program, exitCode: res.exitCode, stderr: (res.stderr || '').slice(-500) });
    return res;
  };
  return calls;
}

// Each CDP run instantiates a fresh WASM module (a multi-MB linear memory); a
// heavy effect's ~100 probes can retain enough of them to OOM a worker before
// V8 gets around to collecting. Force a collection between parameters to keep
// the heap flat. gc() isn't normally exposed, and workers reject an
// --expose-gc execArgv, so enable it programmatically here (runs in both the
// main process and each worker at import time).
if (typeof globalThis.gc !== 'function') {
  try { v8.setFlagsFromString('--expose-gc'); globalThis.gc = vm.runInNewContext('gc'); v8.setFlagsFromString('--no-expose-gc'); } catch { /* leave undefined */ }
}
const maybeGc = () => { try { globalThis.gc?.(); } catch { /* not exposed */ } };

const ownProgram = (effect) => (effect.mixChain ? effect.mixChain.renderProgram : effect.program);

function ownProgramOk(effect, calls) {
  const prog = ownProgram(effect);
  const mine = calls.filter((c) => c.program === prog);
  if (!mine.length) return true; // couldn't observe it; don't invent a failure
  return mine.every((c) => c.exitCode === 0);
}
function clampStderr(calls) {
  return calls.some((c) => c.stderr && CLAMP_RE.test(c.stderr));
}
const tail = (s, n = 400) => String(s || '').split('\n').filter(Boolean).slice(-3).join(' ').slice(-n);

// ---------------------------------------------------------------------------
// Decode / peak — a probe "passes" when applyEffect returns audio that decodes
// with a finite peak. Silence is allowed; multi-out requires every file valid.
// ---------------------------------------------------------------------------
function peakOf(bytes) {
  const d = decodeWav(bytes);
  let peak = 0;
  for (const ch of d.channelData) for (let i = 0; i < ch.length; i++) { const v = Math.abs(ch[i]); if (v > peak) peak = v; }
  return { peak, frames: d.length };
}
function decodeResult(effect, result) {
  try {
    if (effect.multiOut) {
      const outs = result?.outputs || [];
      if (!outs.length) return { ok: false, reason: 'no files' };
      let peak = 0;
      for (const b of outs) { const p = peakOf(b); if (!(p.frames > 0) || !Number.isFinite(p.peak)) return { ok: false, reason: 'bad file' }; peak = Math.max(peak, p.peak); }
      return { ok: true, peak };
    }
    const p = peakOf(result);
    if (!(p.frames > 0) || !Number.isFinite(p.peak)) return { ok: false, reason: 'empty/nan' };
    return { ok: true, peak: p.peak };
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) };
  }
}
function hashResult(effect, result) {
  const h = createHash('sha1');
  if (effect.multiOut) for (const b of (result?.outputs || [])) h.update(b);
  else h.update(result);
  return h.digest('hex');
}

// ---------------------------------------------------------------------------
// Single probe — apply one parameter value-set to the effect and report the
// outcome: pass | reject (CDP said no) | error (harness/data-generator threw).
// ---------------------------------------------------------------------------
async function runProbe(cdp, entry, values, seconds, calls, srcKind) {
  calls.length = 0;
  let result;
  try {
    if (entry.kind === 'generator') {
      result = await applyGenerator(cdp, entry, values, { data: entry.data?.default });
    } else {
      const { src, extra } = sourceFor(entry, seconds, srcKind);
      result = await applyEffect(cdp, entry, values, src, extra);
    }
  } catch (e) {
    const msg = String(e && e.message || e);
    if (REJECT_RE.test(msg)) return { status: 'reject', stderr: tail(msg), bound: parseBound(msg) };
    return { status: 'error', error: msg.split('\n')[0].slice(0, 200) };
  }
  const dec = decodeResult(entry, result);
  if (!dec.ok) return { status: 'reject', stderr: dec.reason };
  // Success = valid decodable audio, matching the catalog test's definition. We
  // deliberately DON'T gate on the program's exit code: several CDP programs
  // (e.g. isolate) return non-zero even on a successful run that writes real
  // output, so an exit-code gate produces false rejections. The exit code is
  // still recorded in telemetry for the report.
  return { status: 'pass', peak: dec.peak, hash: hashResult(entry, result), clampSuspected: clampStderr(calls), exitNonZero: !ownProgramOk(entry, calls) };
}

// ---------------------------------------------------------------------------
// Probe value sets
// ---------------------------------------------------------------------------
const round6 = (v) => Math.round(v * 1e6) / 1e6;

function numericParams(entry) {
  return (entry.params || []).filter((p) => p.choices == null && typeof p.min === 'number' && typeof p.max === 'number');
}
function defaults(entry) {
  return Object.fromEntries((entry.params || []).map((p) => [p.name, p.default]));
}

// The five probe points for one numeric parameter, others held at default.
// `range` is the parameter's *effective* span for those sibling values — for a
// parameter whose bound is coupled to another (a spatialisation centre limited
// by the channel count) that is narrower than the declared min/max, and it is
// what the UI offers, so it is what we probe. `below`/`above` then sit just
// outside the effective bound and confirm the coupling is tight rather than
// merely declared.
function probeValues(p, range) {
  const { min, max } = range || p;
  const step = typeof p.step === 'number' && p.step > 0 ? p.step : null;
  const eps = step != null ? step : Math.max((max - min) / 100, 1e-3);
  const mid = step != null
    ? min + Math.round(((min + max) / 2 - min) / step) * step
    : (min + max) / 2;
  return [
    { label: 'min', value: round6(min), inRange: true },
    { label: 'max', value: round6(max), inRange: true },
    { label: 'mid', value: round6(Math.min(max, Math.max(min, mid))), inRange: true },
    { label: 'below', value: round6(min - eps), inRange: false, edge: 'MIN' },
    { label: 'above', value: round6(max + eps), inRange: false, edge: 'MAX' },
  ];
}

// ---------------------------------------------------------------------------
// Per-entry audit — baseline gate, then classify each numeric parameter.
// Runs identically in-process (serial) and inside a worker.
// ---------------------------------------------------------------------------
async function auditEntry(cdp, entry, opts = {}) {
  const calls = entry.__calls;                 // shared telemetry array (see makeAuditor)
  const findings = [];
  const maskedFallback = entry.derive === DERIVE_PITCH_REF; // derivePitch masks failures with a round-trip
  const probeLog = [];

  const declared = (name) => { const p = (entry.params || []).find((x) => x.name === name); return p ? { min: p.min, max: p.max, default: p.default, step: p.step } : null; };
  const add = (kind, param, extra = {}) => {
    const f = { effect: entry.id, param: param || null, kind, tier: TIER[kind], declared: param ? declared(param) : null, ...extra };
    // For a coupled parameter, say what it was actually held to — the declared
    // span alone would misrepresent what was probed.
    if (param) {
      const pd = (entry.params || []).find((x) => x.name === param);
      if (pd && (pd.minOf || pd.maxOf)) f.effectiveRange = paramRange(pd, defaults(entry));
    }
    if (maskedFallback) f.maskedFallbackPossible = true;
    findings.push(f);
  };

  // 1) Baseline: all defaults. The catalog test proves these produce audio for
  // every real effect, so a failure here is a corrupted default or a regression.
  let base;
  try {
    base = await runProbe(cdp, entry, defaults(entry), PRIMARY_SECONDS, calls);
  } catch (e) {
    add('PROBE_ERROR', null, { detail: String(e && e.message || e).split('\n')[0].slice(0, 200) });
    return { id: entry.id, kind: entry.kind, findings, probeLog, baselineOk: false };
  }
  if (base.status === 'error') {
    add('PROBE_ERROR', null, { detail: base.error });
    return { id: entry.id, kind: entry.kind, findings, probeLog, baselineOk: false };
  }
  if (base.status === 'reject') {
    // Try to attribute the failure to a single parameter's default (BAD_DEFAULT),
    // else it's a whole-baseline failure. Either way, skip per-param probing.
    let culprit = null; let multiple = false;
    for (const p of numericParams(entry)) {
      const pv = probeValues(p, paramRange(p, defaults(entry))).find((v) => v.label === 'mid');
      const vals = { ...defaults(entry), [p.name]: pv.value };
      let r; try { r = await runProbe(cdp, entry, vals, PRIMARY_SECONDS, calls); } catch { r = { status: 'error' }; }
      if (r.status === 'pass') { if (culprit) multiple = true; else culprit = p.name; }
    }
    if (culprit && !multiple) add('BAD_DEFAULT', culprit, { probe: { label: 'default', value: declared(culprit).default }, stderr: base.stderr });
    else add('BASELINE_FAIL', null, { stderr: base.stderr });
    maybeGc();
    return { id: entry.id, kind: entry.kind, findings, probeLog, baselineOk: false };
  }

  // 2) Per numeric parameter, others held at default.
  for (const p of numericParams(entry)) {
    const results = {};
    const eff = paramRange(p, defaults(entry));
    const coupled = eff.min !== p.min || eff.max !== p.max;
    for (const pv of probeValues(p, eff)) {
      const vals = { ...defaults(entry), [p.name]: pv.value };
      let r; try { r = await runProbe(cdp, entry, vals, PRIMARY_SECONDS, calls); } catch (e) { r = { status: 'error', error: String(e && e.message || e).slice(0, 200) }; }
      results[pv.label] = { pv, r };
    }
    probeLog.push({ param: p.name, points: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { value: v.pv.value, status: v.r.status }])) });

    // A harness/data-generator error on an IN-RANGE probe is a real PROBE_ERROR.
    // On an out-of-range below/above probe it just means that outside value can't
    // be built/accepted — i.e. the range is correctly fenced — so ignore it.
    const errored = ['min', 'max', 'mid'].map((l) => results[l]).find((x) => x.r.status === 'error');
    if (errored) { add('PROBE_ERROR', p.name, { probe: { label: errored.pv.label, value: errored.pv.value }, detail: errored.r.error }); continue; }
    for (const l of ['below', 'above']) if (results[l].r.status === 'error') results[l].r = { status: 'reject', stderr: results[l].r.error };

    const nonDeterministic = entry.parityExempt != null; // rand()-driven output: hashes/peaks unstable

    // --- Declared edges (min / max) -----------------------------------------
    // A rejected edge is retried on alternate durations first — many constraints
    // are duration-linked (delay ≥ src length) rather than range bugs.
    for (const label of ['min', 'max']) {
      const { pv, r } = results[label];
      if (r.status === 'pass') continue;
      const d = await diagnoseRejection(cdp, entry, p, pv, calls, r);
      const probe = { label, value: pv.value };
      if (d.validAt || d.tracksDuration) {
        add('INPUT_DEPENDENT', p.name, { probe, validAt: d.validAt, boundIsSourceLength: d.tracksDuration, stderr: r.stderr });
      } else if (d.validOn) {
        add('CONTENT_DEPENDENT', p.name, { probe, validOn: d.validOn, stderr: r.stderr });
      } else {
        add(label === 'min' ? 'OVER_WIDE_MIN' : 'OVER_WIDE_MAX', p.name, { probe, engineBound: d.bound, stderr: r.stderr });
      }
    }
    // --- Interior (mid) ------------------------------------------------------
    // A hole only when both declared edges pass; if an edge already failed the
    // mid failure is subsumed by that OVER_WIDE finding.
    if (results.mid.r.status === 'reject') {
      const probe = { label: 'mid', value: results.mid.pv.value };
      const d = await diagnoseRejection(cdp, entry, p, results.mid.pv, calls, results.mid.r);
      if (d.validAt || d.tracksDuration) add('INPUT_DEPENDENT', p.name, { probe, validAt: d.validAt, boundIsSourceLength: d.tracksDuration, stderr: results.mid.r.stderr });
      else if (d.validOn) add('CONTENT_DEPENDENT', p.name, { probe, validOn: d.validOn, stderr: results.mid.r.stderr });
      else if (results.min.r.status === 'pass' && results.max.r.status === 'pass') add('RANGE_HOLE', p.name, { probe, engineBound: d.bound, stderr: results.mid.r.stderr });
    }

    // --- Outside-bounds probes (below / above) → over-narrow / clamp --------
    if (!nonDeterministic) {
      classifyOverNarrow(add, p, 'below', results.below, results.min);
      classifyOverNarrow(add, p, 'above', results.above, results.max);
    }
    maybeGc(); // release this parameter's WASM instances before the next
  }

  return { id: entry.id, kind: entry.kind, findings, probeLog, baselineOk: true };
}

// An outside probe that passes means CDP accepted a value beyond the declared
// range. Whether it *used* that value or silently clamped it is inferred from
// the output hash (and any clamp warning) — but that inference is not stable:
// a few programs' output varies with allocator state when many effects share a
// worker's CDP, which flipped findings between two kinds run-to-run and churned
// the baseline. So the kind is always OVER_NARROW_*, keeping the finding key
// stable, and the clamp verdict rides along as metadata.
function classifyOverNarrow(add, p, label, outside, edge) {
  if (!outside || outside.r.status !== 'pass') return;      // rejected outside → range is correctly fenced
  if (edge.r.status !== 'pass') return;                     // edge itself failed → handled elsewhere
  const kind = label === 'below' ? 'MIN' : 'MAX';
  const clamped = outside.r.hash === edge.r.hash || outside.r.clampSuspected;
  add(`OVER_NARROW_${kind}`, p.name, {
    probe: { label, value: outside.pv.value },
    clamped,
    note: clamped
      ? 'outside value accepted but output matches the edge → CDP likely clamped it internally'
      : 'CDP accepts beyond the declared range',
  });
}

/**
 * Work out why an in-range probe was rejected, by re-running it on the alternate
 * durations. Two ways it can turn out to be duration-linked rather than a bad
 * declared range:
 *   1. it simply passes on another duration, or
 *   2. CDP names a different bound each time — e.g. `waveform.make.time` reports
 *      "0 to 1" on a 1 s source and "0 to 4" on a 4 s one, i.e. the limit *is*
 *      the source length. A limit that stays put across durations (2 to 16) is a
 *      real property of the program, so the declared range is genuinely wrong —
 *      and `bound` then tells us exactly what to narrow it to.
 * Generators take no audio input, so duration-dependence can't apply to them.
 */
async function diagnoseRejection(cdp, entry, p, pv, calls, primary) {
  const bound = primary?.bound || null;
  if (entry.kind === 'generator') return { validAt: null, tracksDuration: false, validOn: null, bound };
  const vals = { ...defaults(entry), [p.name]: pv.value };
  let tracksDuration = false;
  for (const secs of ALT_SECONDS) {
    let r; try { r = await runProbe(cdp, entry, vals, secs, calls); } catch { r = { status: 'error' }; }
    if (r.status === 'pass') return { validAt: secs, tracksDuration, validOn: null, bound };
    if (bound && r.bound && !sameBound(bound, r.bound)) tracksDuration = true;
  }
  // Still rejected at every duration. Many CDP programs need a *feature* the
  // probe signal lacks — a detectable pitch, grain onsets, envelope troughs —
  // and say so ("No pitch found", "No grains found"). Retry on the other test
  // signals: passing on one means the declared range is fine and it was the
  // material that was wrong, which is a caveat for the user, not a range bug.
  const own = sourceKind(entry);
  for (const kind of ALL_KINDS) {
    if (kind === own) continue;
    let r; try { r = await runProbe(cdp, entry, vals, PRIMARY_SECONDS, calls, kind); } catch { r = { status: 'error' }; }
    if (r.status === 'pass') return { validAt: null, tracksDuration, validOn: kind, bound };
  }
  return { validAt: null, tracksDuration, validOn: null, bound };
}

// derivePitch is referenced by identity so auditEntry can flag effects whose
// failures its constant-pitch fallback could mask. Resolved lazily (it isn't
// exported); null in workers that never import catalog internals is fine.
let DERIVE_PITCH_REF = null;

// ---------------------------------------------------------------------------
// Entry table — probeable effects (skip the 7 pipeline effects whose internal
// try/catch fallback masks failures) plus the synthesis generators.
// ---------------------------------------------------------------------------
function buildEntries() {
  const effects = EFFECTS.filter((e) => !e.pipeline).map((e) => ({ ...e, kind: 'effect' }));
  const skipped = EFFECTS.filter((e) => e.pipeline).map((e) => e.id);
  const generators = (GENERATORS || []).map((g) => ({ ...g, kind: 'generator' }));
  // Record which effects carry the derivePitch fallback so findings get flagged.
  DERIVE_PITCH_REF = EFFECTS.find((e) => e.derive && e.needs?.includes('repitch'))?.derive || null;
  for (const e of effects) if (e.derive === DERIVE_PITCH_REF) e.derive = DERIVE_PITCH_REF; // preserve identity after spread
  return { entries: [...effects, ...generators], skipped };
}

// ---------------------------------------------------------------------------
// Cache — per-entry, keyed by a hash of the entry definition (functions
// included) + protocol version, so editing one effect invalidates only it.
// ---------------------------------------------------------------------------
function entryHash(entry) {
  const json = JSON.stringify(entry, (k, v) => (typeof v === 'function' ? v.toString() : v));
  return createHash('sha1').update(`v${PROTOCOL_VERSION}:${json}`).digest('hex');
}
function loadCache() {
  try { const c = JSON.parse(readFileSync(CACHE_PATH, 'utf8')); if (c.version === PROTOCOL_VERSION) return c; } catch { /* none */ }
  return { version: PROTOCOL_VERSION, entries: {} };
}
function saveCache(cache) {
  try { mkdirSync(dirname(CACHE_PATH), { recursive: true }); writeFileSync(CACHE_PATH, JSON.stringify(cache)); } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Baseline (triage) file — maps finding keys → notes. Findings present in it are
// "known"; absent ones are "new"; keys with no matching finding are "stale".
// ---------------------------------------------------------------------------
const findingKey = (f) => `${f.effect}/${f.param || '-'}/${f.kind}`;
function loadBaseline() {
  try { return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch { return { findings: {} }; }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
function makeAuditor() {
  const cdp = new CDP();
  const calls = instrument(cdp);
  return async (entry) => { entry.__calls = calls; return auditEntry(cdp, entry, {}); };
}

async function runSerial(entries, onProgress) {
  const audit = makeAuditor();
  const out = new Map();
  for (const entry of entries) { const res = await audit(entry); out.set(entry.id, res); onProgress?.(res); }
  return out;
}

// A worker accumulates every distinct CDP *program* WASM module it loads and
// those can't be reclaimed by gc(), so a long-lived worker climbs toward the
// heap ceiling. Retire each worker after a few entries and spawn a fresh isolate
// to keep draining; and if a worker dies anyway (OOM), requeue its in-flight
// entry on a new worker rather than aborting the whole run.
const RECYCLE_EVERY = 8;
const WORKER_HEAP_MB = 3072;
const MAX_ENTRY_RETRIES = 2;
const ENTRY_TIMEOUT_MS = 120_000; // kill a worker silent this long (hung probe)

async function runPool(entries, jobs, onProgress) {
  const queue = entries.map((e) => e.id);
  const total = entries.length;
  const out = new Map();
  const retries = new Map();
  const n = Math.min(jobs, Math.max(1, queue.length));
  await new Promise((resolveAll) => {
    let done = 0; let finished = false;
    const alive = new Set();
    const finalize = (res) => { out.set(res.id, res); done++; onProgress?.(res, done, total); };
    const finish = () => { if (finished) return; finished = true; for (const w of alive) { w._intentional = true; w.terminate(); } resolveAll(out); };
    const checkDone = () => { if (done >= total) finish(); };
    const spawnIfNeeded = () => { while (alive.size < n && queue.length > 0 && done < total) spawn(); };

    // `firstId` hands a specific entry to a brand-new worker. A worker that dies
    // from accumulated memory takes its in-flight entry down with it, and
    // returning that entry to the shared queue lets another already-loaded
    // worker pick it up and die too — so a small, blameless effect can burn all
    // its retries on its neighbours' memory pressure. Retrying on a fresh
    // isolate gives it the clean run it would have had on its own.
    const spawn = (firstId = null) => {
      let pending = firstId;
      const w = new Worker(SELF_URL, { workerData: { worker: true }, resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB } });
      w._count = 0; w._inflight = null; w._intentional = false; w._timer = null;
      alive.add(w);
      const disarm = () => { if (w._timer) { clearTimeout(w._timer); w._timer = null; } };
      // callMain() runs synchronously inside the worker and blocks its event
      // loop, so a pathological probe (e.g. an unbounded CDP run) can't be
      // interrupted from inside — only by killing the worker. If a worker goes
      // silent past ENTRY_TIMEOUT_MS, terminate it; the exit handler requeues.
      const arm = () => { disarm(); w._timer = setTimeout(() => { w.terminate(); }, ENTRY_TIMEOUT_MS); };
      const stop = () => { disarm(); w._intentional = true; w.terminate(); };
      const pump = () => {
        const id = pending != null ? pending : queue.shift();
        pending = null;
        if (id == null) { stop(); return; }         // no work left for this worker
        w._inflight = id;
        arm();
        w.postMessage({ type: 'audit', id });
      };
      w.on('message', (msg) => {
        if (msg.type === 'ready') { pump(); return; }
        if (msg.type !== 'result') return;
        disarm(); w._inflight = null; w._count++;
        finalize(msg.res);
        if (done >= total) { finish(); return; }
        if (queue.length === 0) { stop(); return; }
        if (w._count >= RECYCLE_EVERY) { stop(); spawn(); return; } // fresh isolate, keep draining
        pump();
      });
      w.on('error', () => { /* surfaced as a non-zero exit below */ });
      w.on('exit', () => {
        disarm(); alive.delete(w);
        if (w._intentional) return;                  // clean recycle / drain
        // Crash (almost always OOM) mid-entry: retry it on a fresh worker, or
        // record a PROBE_ERROR if it keeps killing workers.
        const id = w._inflight;
        if (id != null) {
          const r = (retries.get(id) || 0) + 1; retries.set(id, r);
          if (r <= MAX_ENTRY_RETRIES) { spawn(id); checkDone(); return; }  // dedicated fresh isolate
          finalize({ id, kind: '?', findings: [{ effect: id, param: null, kind: 'PROBE_ERROR', tier: 'error', detail: `worker died (OOM?) ${r}×` }], probeLog: [], baselineOk: false });
        }
        checkDone();
        spawnIfNeeded();
      });
    };
    for (let i = 0; i < n; i++) spawn();
  });
  return out;
}

// Worker side: import the entry table once, keep a warm CDP, audit on request.
async function workerMain() {
  const { entries } = buildEntries();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const cdp = new CDP();
  const calls = instrument(cdp);
  parentPort.on('message', async (msg) => {
    if (msg.type !== 'audit') return;
    const entry = byId.get(msg.id);
    entry.__calls = calls;
    let res;
    try { res = await auditEntry(cdp, entry, {}); }
    catch (e) { res = { id: msg.id, kind: entry.kind, findings: [{ effect: msg.id, param: null, kind: 'PROBE_ERROR', tier: 'error', detail: String(e && e.message || e).slice(0, 200) }], probeLog: [], baselineOk: false }; }
    parentPort.postMessage({ type: 'result', res });
  });
  parentPort.postMessage({ type: 'ready' });
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const TIER_ORDER = { error: 0, warn: 1, advisory: 2 };
function summarize(allFindings) {
  const byKind = {};
  for (const f of allFindings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
  return byKind;
}

function printReport(results, { skipped, baseline, entries, opts }) {
  const all = [];
  for (const res of results.values()) all.push(...res.findings);
  all.sort((a, b) => (TIER_ORDER[a.tier] - TIER_ORDER[b.tier]) || a.effect.localeCompare(b.effect));

  const baseKeys = new Set(Object.keys(baseline.findings || {}));
  const currentKeys = new Set(all.map(findingKey));
  const isNew = (f) => !baseKeys.has(findingKey(f));
  const newFindings = all.filter(isNew);
  const advisory = all.filter((f) => f.tier === 'advisory');
  const staleKeys = [...baseKeys].filter((k) => !currentKeys.has(k));

  // Per-entry progress already streamed; here print the classified list.
  if (opts.verbose || all.length) {
    console.log('\n— Findings —');
    for (const f of all) {
      const flag = isNew(f) ? 'NEW ' : 'known';
      const d = f.declared ? ` [${f.declared.min}..${f.declared.max}]` : '';
      const at = f.probe ? ` @${f.probe.label}=${f.probe.value}` : '';
      const dep = f.validAt ? ` (valid @${f.validAt}s)` : '';
      const mf = f.maskedFallbackPossible ? ' ~maskedFallback' : '';
      const st = f.stderr ? `  ${String(f.stderr).slice(0, 70)}` : (f.detail ? `  ${f.detail.slice(0, 70)}` : '');
      console.log(`  ${f.tier.padEnd(8)} ${flag} ${f.kind.padEnd(16)} ${f.effect}${f.param ? '.' + f.param : ''}${d}${at}${dep}${mf}${st}`);
    }
  }

  const byKind = summarize(all);
  console.log('\n— Summary by kind —');
  for (const kind of Object.keys(TIER).filter((k) => byKind[k])) console.log(`  ${kind.padEnd(16)} ${byKind[kind]}`);
  if (skipped.length) console.log(`  (skipped ${skipped.length} pipeline effect${skipped.length > 1 ? 's' : ''}: ${skipped.join(', ')})`);
  if (staleKeys.length) console.log(`  stale baseline keys (fixed?): ${staleKeys.length}\n    ${staleKeys.join('\n    ')}`);

  const errs = all.filter((f) => f.tier === 'error').length;
  const warns = all.filter((f) => f.tier === 'warn').length;
  console.log(`\n${all.length} findings (${newFindings.length} new vs baseline, ${advisory.length} advisory) — ${errs} error, ${warns} warn`);

  return { all, newFindings, advisory, staleKeys };
}

function writeReport(path, results, meta) {
  const all = [];
  for (const res of results.values()) all.push(...res.findings);
  const report = {
    generatedProtocol: PROTOCOL_VERSION,
    counts: summarize(all),
    skipped: meta.skipped,
    findings: all,
    probeDetail: Object.fromEntries([...results.entries()].map(([id, r]) => [id, r.probeLog])),
  };
  writeFileSync(path, JSON.stringify(report, null, 2));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const o = { jobs: Math.min(8, Math.max(1, os.cpus().length - 1)), out: DEFAULT_OUT, readCache: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--effect') o.effect = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--param') o.param = argv[++i];
    else if (a === '--jobs') o.jobs = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (a === '--out') o.out = resolve(process.cwd(), argv[++i]);
    else if (a === '--no-cache') o.readCache = false;
    else if (a === '--update-baseline') o.updateBaseline = true;
    else if (a === '--strict') o.strict = true;
    else if (a === '--self-test') o.selfTest = true;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--help' || a === '-h') o.help = true;
  }
  return o;
}

const HELP = `audit-param-ranges — validate catalog parameter ranges against live CDP

  --effect <id,...>   only audit these effect/generator ids
  --param <name>      only probe this parameter name
  --jobs <n>          worker_threads pool size (default min(8,cpus-1); 1 = serial)
  --out <path>        report JSON (default param-ranges-report.json)
  --no-cache          ignore the per-effect cache
  --update-baseline   rewrite the triage baseline from this run's findings
  --strict            exit 1 if any new (non-baselined) findings
  --self-test         run detector self-tests on corrupted-range fixtures
  --verbose           list findings even when none are new`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { console.log(HELP); return; }
  if (opts.selfTest) return selfTest();

  const { entries: allEntries, skipped } = buildEntries();
  let entries = allEntries;
  if (opts.effect) { const want = new Set(opts.effect); entries = entries.filter((e) => want.has(e.id)); }
  if (opts.param) entries = entries.map((e) => ({ ...e, params: (e.params || []).filter((p) => p.name === opts.param) })).filter((e) => e.params.length);
  if (!entries.length) { console.error('no matching effects/generators'); process.exit(2); }

  const baseline = loadBaseline();
  const cache = loadCache();   // always loaded: --no-cache skips reuse, not refresh
  const results = new Map();

  // Cache split: reuse unchanged entries, probe the rest. The per-entry hash
  // covers the full definition (functions included) and probe protocol, so a
  // stored entry is only reused when it matches exactly — subset/--param runs
  // carry a different hash and never collide with a full run's cache.
  const hashById = new Map();
  const todo = [];
  let reused = 0;
  for (const e of entries) {
    const h = entryHash(e);
    hashById.set(e.id, h);
    if (opts.readCache && cache.entries[e.id]?.hash === h) { results.set(e.id, cache.entries[e.id].result); reused++; }
    else todo.push(e);
  }

  const t0 = Date.now();
  console.log(`Auditing ${todo.length} entr${todo.length === 1 ? 'y' : 'ies'}${reused ? ` (${reused} from cache)` : ''} at ${opts.jobs} job${opts.jobs > 1 ? 's' : ''}…`);
  const onProgress = (res) => {
    const errs = res.findings.filter((f) => f.tier === 'error').length;
    const warns = res.findings.filter((f) => f.tier === 'warn').length;
    const adv = res.findings.filter((f) => f.tier === 'advisory').length;
    const tag = !res.baselineOk ? 'BASELINE' : (errs || warns || adv) ? `${errs}e ${warns}w ${adv}a` : 'ok';
    if (opts.verbose || errs || warns || !res.baselineOk) console.log(`  ${res.id.padEnd(24)} ${tag}`);
  };

  const fresh = todo.length && opts.jobs === 1 ? await runSerial(todo, onProgress)
    : todo.length ? await runPool(todo, opts.jobs, onProgress) : new Map();
  for (const [id, res] of fresh) {
    results.set(id, res);
    // A crashed worker says nothing about the entry itself — caching that would
    // replay a one-off failure on every later run and permanently contradict a
    // baseline recorded from a good run. Only cache reproducible outcomes.
    const transient = (res.findings || []).some((f) => f.kind === 'PROBE_ERROR' && /worker died/.test(f.detail || ''));
    if (transient) delete cache.entries[id];
    else cache.entries[id] = { hash: hashById.get(id), result: res };
  }
  saveCache(cache);

  const summary = printReport(results, { skipped, baseline, entries, opts });
  writeReport(opts.out, results, { skipped });
  console.log(`\nreport → ${opts.out}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  if (opts.updateBaseline) {
    const next = { findings: {} };
    const all = [...results.values()].flatMap((r) => r.findings);
    for (const f of all) next.findings[findingKey(f)] = baseline.findings?.[findingKey(f)] || { tier: f.tier, note: '' };
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`baseline → ${BASELINE_PATH} (${Object.keys(next.findings).length} keys)`);
  }

  if (opts.strict && summary.newFindings.length) process.exit(1);
}

// ---------------------------------------------------------------------------
// Self-test — corrupt real effects' ranges in memory and assert the detector
// reports the expected kind. Proves the detector detects before we trust it.
// ---------------------------------------------------------------------------
async function selfTest() {
  const { entries } = buildEntries();
  const byId = new Map(entries.map((e) => [e.id, e]));
  const clone = (id, mutate) => { const e = structuredCloneEntry(byId.get(id)); mutate(e); return e; };

  const cases = [];
  // 1) modify.speed with max clipped to 12 → CDP accepts far more → OVER_NARROW_MAX.
  cases.push(['OVER_NARROW_MAX', clone('modify.speed', (e) => { e.params[0].max = 12; }), 'OVER_NARROW_MAX']);
  // 2) modify.loudness gain min pushed negative (gain is positive-only) → OVER_WIDE_MIN.
  cases.push(['OVER_WIDE_MIN', clone('modify.loudness', (e) => { e.params[0].min = -50; e.params[0].step = 5; }), 'OVER_WIDE_MIN']);
  // 3) corrupted default (out of any sane range) → BAD_DEFAULT + baseline gating.
  cases.push(['BAD_DEFAULT', clone('modify.speed', (e) => { e.params[0].default = 9999; }), 'BAD_DEFAULT']);
  // 4) sfecho requires delay ≥ source duration, so its declared min delay (0.5 s)
  // is rejected on the 1 s primary but valid on the 0.4 s source → INPUT_DEPENDENT.
  cases.push(['INPUT_DEPENDENT', structuredCloneEntry(byId.get('sfecho.echo')), 'INPUT_DEPENDENT']);

  // A coupled bound is a function of sibling values, so a typo in the property
  // name (v.chan for v.chans) yields NaN, which paramRange ignores — silently
  // switching the constraint off. Check every declared coupling resolves.
  let fail = 0;
  let coupled = 0;
  for (const entry of entries) {
    const vals = defaults(entry);
    for (const p of entry.params || []) {
      for (const key of ['minOf', 'maxOf']) {
        if (typeof p[key] !== 'function') continue;
        coupled++;
        let v;
        try { v = Number(p[key](vals)); } catch (e) { v = NaN; }
        if (!Number.isFinite(v) && v !== Infinity) {
          fail++;
          console.log(`FAIL ${'coupling'.padEnd(18)} ${entry.id}.${p.name} ${key} → ${v} (bad sibling name?)`);
        }
      }
    }
  }
  console.log(`ok   ${'couplings'.padEnd(18)} ${coupled} declared, all resolve to a number`);

  const audit = makeAuditor();
  for (const [name, entry, wantKind] of cases) {
    const res = await audit(entry);
    const kinds = new Set(res.findings.map((f) => f.kind));
    const ok = kinds.has(wantKind);
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(18)} → ${[...kinds].join(',') || '(none)'} ${ok ? '' : `(wanted ${wantKind})`}`);
  }
  console.log(fail ? `\n${fail} self-test failure(s)` : `\nAll ${cases.length} self-tests passed.`);
  process.exit(fail ? 1 : 0);
}

// structuredClone can't copy functions; deep-copy params array, keep function refs.
function structuredCloneEntry(entry) {
  return { ...entry, params: (entry.params || []).map((p) => ({ ...p })) };
}

// ---------------------------------------------------------------------------
if (isMainThread) {
  main().catch((e) => { console.error(e); process.exit(1); });
} else {
  workerMain();
}
