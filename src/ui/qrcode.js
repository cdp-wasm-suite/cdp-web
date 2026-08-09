// Minimal QR Code encoder (byte mode, versions 1–40, ISO/IEC 18004). Written
// here rather than pulled in as a dependency: the whole encoder is smaller than
// the vendoring plumbing would be, and the only caller is the share dialog,
// which turns a #patch= link into something a phone camera can follow.
//
// qrMatrix(text) → { size, version, ecc, modules } where modules[y * size + x]
// is 1 for a dark module. Throws if the text is past QR's ~2.9 KB ceiling.

// ---- GF(256) arithmetic, x^8 + x^4 + x^3 + x^2 + 1 --------------------------
const EXP = new Uint8Array(256), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x & 0x80 ? 0x11d : 0); }
const gmul = (a, b) => (a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0);

// ---- per-version tables (index [ecc][version], version 1-based) -------------
// ECC codewords per block, and how many blocks the data is split across.
const ECC_CW = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const ECC_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};
const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// Total modules available to data + ECC in a version, before the format bits:
// the full square less the finder/timing/alignment/version function patterns.
function rawModules(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const a = Math.floor(v / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}
const dataCodewords = (v, ecc) => Math.floor(rawModules(v) / 8) - ECC_CW[ecc][v] * ECC_BLOCKS[ecc][v];
// Byte mode: 4-bit mode indicator + an 8- or 16-bit character count.
const headerBits = (v) => 4 + (v < 10 ? 8 : 16);
const fits = (len, v, ecc) => headerBits(v) + len * 8 <= dataCodewords(v, ecc) * 8;

// ---- data codewords ---------------------------------------------------------
function makeData(bytes, v, ecc) {
  const cap = dataCodewords(v, ecc) * 8;
  const out = new Uint8Array(cap / 8);
  let n = 0;
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--, n++) out[n >> 3] |= ((val >>> i) & 1) << (7 - (n & 7)); };
  push(4, 4);                                  // byte mode
  push(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, cap - n));               // terminator, then pad to a byte
  n = (n + 7) & ~7;
  // The standard's alternating pad bytes fill whatever the message leaves over.
  for (let i = n / 8, pad = 0xEC; i < out.length; i++, pad ^= 0xEC ^ 0x11) out[i] = pad;
  return out;
}

function rsGenerator(deg) {
  let g = [1];                                 // g[0] is the highest-degree coefficient
  for (let i = 0; i < deg; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function rsRemainder(data, deg) {
  const g = rsGenerator(deg), res = new Uint8Array(deg);
  for (const b of data) {
    const factor = b ^ res[0];
    res.copyWithin(0, 1); res[deg - 1] = 0;
    for (let j = 0; j < deg; j++) res[j] ^= gmul(g[j + 1], factor);
  }
  return res;
}

// Split into blocks, append each block's ECC, then interleave — the codeword
// order the standard lays into the symbol.
function interleave(data, v, ecc) {
  const nBlocks = ECC_BLOCKS[ecc][v], eccLen = ECC_CW[ecc][v];
  const shortLen = Math.floor(data.length / nBlocks), nLong = data.length % nBlocks;
  const blocks = [];
  for (let i = 0, off = 0; i < nBlocks; i++) {
    const len = shortLen + (i >= nBlocks - nLong ? 1 : 0);
    const d = data.subarray(off, off + len); off += len;
    blocks.push({ d, e: rsRemainder(d, eccLen) });
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.e[i]);
  return Uint8Array.from(out);
}

// ---- symbol layout ----------------------------------------------------------
function alignPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const pos = [6];
  for (let p = v * 4 + 10; pos.length < n; p -= step) pos.splice(1, 0, p);
  return pos;
}
// BCH(15,5) for format info, BCH(18,6) for version info.
const bch = (data, poly, deg) => {
  let rem = data << deg;
  for (let i = deg - 1; i >= 0; i--) if ((rem >>> (deg + i)) & 1) rem ^= poly << i;
  return (data << deg) | rem;
};

// Order matters: the timing lines run edge to edge, then the finders and the
// alignment patterns overwrite the stretches they cross.
function drawFunctionPatterns(m, fn, size, v, ecc) {
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y * size + x] = dark ? 1 : 0; fn[y * size + x] = 1; } };
  for (let i = 0; i < size; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
  // Finders + their separators: rings at Chebyshev distance 0–1 and 3 are dark.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  const ap = alignPositions(v);
  for (let a = 0; a < ap.length; a++) for (let b = 0; b < ap.length; b++) {
    const corner = (a === 0 && b === 0) || (a === 0 && b === ap.length - 1) || (a === ap.length - 1 && b === 0);
    if (corner) continue;                                       // overlaps a finder
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      set(ap[a] + dx, ap[b] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  set(8, size - 8, 1);                                          // the always-dark module
  if (v >= 7) {
    const bits = bch(v, 0x1f25, 12);
    for (let i = 0; i < 18; i++) {
      const dark = (bits >>> i) & 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark); set(b, a, dark);
    }
  }
  drawFormat(m, fn, size, ecc, 0);   // reserves the strips; the real bits land once a mask is picked
}

function drawFormat(m, fn, size, ecc, mask) {
  const bits = bch((FORMAT_BITS[ecc] << 3) | mask, 0x537, 10) ^ 0x5412;
  const put = (x, y, i) => { m[y * size + x] = (bits >>> i) & 1; fn[y * size + x] = 1; };
  for (let i = 0; i <= 5; i++) put(8, i, i);
  put(8, 7, 6); put(8, 8, 7); put(7, 8, 8);
  for (let i = 9; i < 15; i++) put(14 - i, 8, i);
  for (let i = 0; i < 8; i++) put(size - 1 - i, 8, i);
  for (let i = 8; i < 15; i++) put(8, size - 15 + i, i);
}

function drawCodewords(m, fn, size, cw) {
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                                 // the vertical timing column
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y * size + x] && i < cw.length * 8) {
        m[y * size + x] = (cw[i >>> 3] >>> (7 - (i & 7))) & 1;
        i++;
      }
    }
  }
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
const applyMask = (m, fn, size, mask) => {
  const f = MASKS[mask];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (!fn[y * size + x] && f(x, y)) m[y * size + x] ^= 1;
};

// The standard's four penalty rules, used only to pick the least-ugly mask —
// every mask decodes, so an approximation here costs nothing but scan margin.
function penalty(m, size) {
  const at = (x, y) => m[y * size + x];
  const FINDER = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];   // 1:1:3:1:1 plus a light run
  let score = 0, dark = 0;
  for (let a = 0; a < size; a++) {
    // rules 1 + 3, once along each row and once down each column
    for (const line of [(b) => at(b, a), (b) => at(a, b)]) {
      let run = 1;
      for (let b = 1; b < size; b++) {
        if (line(b) === line(b - 1)) { run++; if (run === 5) score += 3; else if (run > 5) score += 1; }
        else run = 1;
      }
      for (let b = 0; b + 11 <= size; b++) {
        let fwd = true, rev = true;
        for (let k = 0; k < 11; k++) {
          if (line(b + k) !== FINDER[k]) fwd = false;
          if (line(b + 10 - k) !== FINDER[k]) rev = false;
        }
        if (fwd || rev) score += 40;
      }
    }
  }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++)   // rule 2: 2×2 blocks
    if (at(x, y) === at(x + 1, y) && at(x, y) === at(x, y + 1) && at(x, y) === at(x + 1, y + 1)) score += 3;
  for (let i = 0; i < m.length; i++) dark += m[i];
  score += Math.floor(Math.abs(dark * 20 - m.length * 10) / m.length) * 10;   // rule 4: dark/light balance
  return score;
}

// Smallest version that holds `text`, at the strongest ECC level that still fits
// in it — a share link is long, so the version is set by capacity and the extra
// redundancy comes free.
function pickVersion(len, minEcc) {
  const start = ECC_LEVELS.indexOf(minEcc);
  for (let v = 1; v <= 40; v++)
    for (let i = ECC_LEVELS.length - 1; i >= start; i--)
      if (fits(len, v, ECC_LEVELS[i])) return { version: v, ecc: ECC_LEVELS[i] };
  return null;
}

export function qrMatrix(text, { minEcc = 'L' } = {}) {
  const bytes = new TextEncoder().encode(String(text));
  const pick = pickVersion(bytes.length, minEcc);
  if (!pick) throw new Error(`too long for a QR code (${bytes.length} bytes)`);
  const { version, ecc } = pick;
  const size = version * 4 + 17;
  const m = new Uint8Array(size * size), fn = new Uint8Array(size * size);
  drawFunctionPatterns(m, fn, size, version, ecc);
  drawCodewords(m, fn, size, interleave(makeData(bytes, version, ecc), version, ecc));
  let best = -1, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(m, fn, size, mask);
    drawFormat(m, fn, size, ecc, mask);
    const s = penalty(m, size);
    if (s < bestScore) { bestScore = s; best = mask; }
    applyMask(m, fn, size, mask);                                // undo, ready for the next
  }
  applyMask(m, fn, size, best);
  drawFormat(m, fn, size, ecc, best);
  return { size, version, ecc, mask: best, modules: m };
}

// Paint a matrix into a canvas at one device pixel per module (plus the 4-module
// quiet zone scanners need) and let CSS blow it up — crisp at any DPR, no
// resampling, and the whole image is a couple of KB. Always dark-on-white:
// a theme-inverted code is a coin flip for camera apps.
export function drawQr(canvas, { size, modules }, { quiet = 4 } = {}) {
  const dim = size + quiet * 2;
  canvas.width = canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if (modules[y * size + x]) ctx.fillRect(x + quiet, y + quiet, 1, 1);
  return canvas;
}
