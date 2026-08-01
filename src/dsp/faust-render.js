// The offline Faust render core plus factory-metadata helpers — pure code with
// no DOM dependencies, shared by faust.js (main-thread fallback path) and
// faust-worker.js (the normal path: compile AND render off the main thread).

export const BLOCK = 128;

// Pad/truncate a channel to `frames` samples.
export function fit(ch, frames) {
  if (ch.length === frames) return ch;
  const out = new Float32Array(frames);
  out.set(ch.subarray(0, frames));
  return out;
}

// Linear-interpolated lookup into a sorted [[t,v],…] breakpoint list at time `t`.
export function sampleAt(pts, t) {
  if (!pts.length) return 0;
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      const span = t1 - t0;
      return span > 0 ? v0 + (v1 - v0) * ((t - t0) / span) : v1;
    }
  }
  return pts[pts.length - 1][1];
}

// Walk a compiled DSP's UI metadata → { addresses: name→address, params: [spec] }
// (cdp-style param specs, the shape paramRow expects).
export function extractParams(ui) {
  const addresses = {};
  const params = [];
  const walk = (items) => (items || []).forEach((it) => {
    if (it.items) return walk(it.items);
    if (!it.address) return;
    const name = it.address.split('/').pop();
    addresses[name] = it.address;
    if (it.type === 'vslider' || it.type === 'hslider' || it.type === 'nentry') {
      params.push({ name, label: it.label || name, min: +it.min, max: +it.max, default: +it.init, step: +it.step || 0.01, env: true });
    } else if (it.type === 'button' || it.type === 'checkbox') {
      params.push({ name, label: it.label || name, min: 0, max: 1, default: +it.init || 0, step: 1, env: true });
    }
  });
  walk(ui);
  return { addresses, params };
}

// Render one fresh DSP instance over `frames` samples, with per-block param
// modulation. Returns nOut channels. inputChannels feeds the DSP's audio inputs
// (missing/short channels are zero-padded). A fresh instance per call gives
// per-channel independence when we replicate across channels.
export async function renderInstance(gen, sr, frames, addresses, params, values, mod, inputChannels) {
  const proc = await gen.createOfflineProcessor(sr, BLOCK);
  const nIn = proc.getNumInputs();
  const nOut = proc.getNumOutputs();
  for (const p of params) {
    const a = addresses[p.name];
    if (!a || mod[p.name]) continue;            // modulated params are set per block
    const v = values[p.name];
    proc.setParamValue(a, v != null ? +v : p.default);
  }
  const out = Array.from({ length: nOut }, () => new Float32Array(frames));
  const inBufs = Array.from({ length: nIn }, () => new Float32Array(BLOCK));
  const outBufs = Array.from({ length: nOut }, () => new Float32Array(BLOCK));
  const modList = Object.entries(mod).filter(([k]) => addresses[k]);
  proc.start();
  for (let pos = 0; pos < frames; pos += BLOCK) {
    const len = Math.min(BLOCK, frames - pos);
    const t = pos / sr;
    for (const [k, pts] of modList) proc.setParamValue(addresses[k], sampleAt(pts, t));
    for (let c = 0; c < nIn; c++) {
      const src = inputChannels[c];
      const buf = inBufs[c];
      for (let i = 0; i < BLOCK; i++) buf[i] = (src && pos + i < frames) ? src[pos + i] : 0;
    }
    proc.compute(inBufs, outBufs);
    for (let c = 0; c < nOut; c++) out[c].set(outBufs[c].subarray(0, len), pos);
  }
  proc.stop();
  proc.destroy?.();
  return out;
}
