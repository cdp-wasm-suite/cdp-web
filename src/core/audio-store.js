// A content-addressed store for Source audio, kept in IndexedDB.
//
// A patch is a document: its Source nodes are input the user chose, and unlike a
// generator's output or a rendered result they cannot be recomputed. localStorage
// is far too small to hold WAVs (~5 MB, and base64 inflates by a third), so the
// bytes live here and the patch carries only a key. Reloading the page — or
// reopening a saved .cdp on the same machine — restores the sounds.
//
// Keys are a hash of the bytes, so the same audio stored twice costs one copy.
// That is the common case rather than a nicety: dragging a node's ⠿ handle onto
// the desktop hands the new Source the *same* Uint8Array, and a patch usually feeds
// one file into several chains.
//
// Everything degrades to a no-op: private-mode browsers, a disabled IndexedDB, a
// full disk. Callers get null and carry on with session-only audio, which is what
// the app did before this store existed.

const DB_NAME = 'cdp-web-audio';
const STORE = 'wavs';
const DB_VERSION = 1;
// Total bytes to keep. Past this the least-recently-used records go, so an
// afternoon of dragging sounds around can't fill the user's disk. Deliberately
// generous: audio is the expensive thing to lose, and a browser's own quota
// (typically a percentage of free space) is the real backstop.
const CAP_BYTES = 512 * 1024 * 1024;

let dbPromise = null;
let broken = false;          // IndexedDB unavailable/refused — stop trying
let onBrokenOnce = null;     // one-shot notice for the caller (see setDiagnostics)

// Report the first failure to the app once, so it can log a line rather than
// silently behaving as though nothing is stored.
export function setStoreDiagnostics(fn) { onBrokenOnce = fn; }
function giveUp(what, err) {
  if (broken) return null;
  broken = true;
  try { onBrokenOnce?.(`${what}: ${err?.message || err}`); } catch { /* diagnostics are optional */ }
  return null;
}

function openDb() {
  if (broken) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (e) { resolve(giveUp('audio store unavailable', e)); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'key' });
        os.createIndex('ts', 'ts');   // least-recently-used first, for pruning
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgrading the schema would block us forever otherwise.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => resolve(giveUp('audio store unavailable', req.error));
    req.onblocked = () => resolve(giveUp('audio store blocked by another tab', null));
  });
  return dbPromise;
}

// One transaction, resolved when it *commits* — not when the last request
// succeeds, since a transaction can still fail afterwards (a quota error is
// raised at commit time). `run` collects whatever it needs into its own closure.
function tx(db, mode, run) {
  return new Promise((resolve, reject) => {
    let t;
    try { t = db.transaction(STORE, mode); }
    catch (e) { reject(e); return; }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
    try { run(t.objectStore(STORE)); }
    catch (e) { try { t.abort(); } catch { /* already gone */ } reject(e); }
  });
}

// Content hash. SHA-256 where the page is a secure context (https / localhost);
// otherwise a 128-bit FNV-1a variant, which is plenty to tell distinct sounds
// apart. The prefix keeps the two schemes from ever colliding with each other.
async function hashBytes(bytes) {
  if (globalThis.crypto?.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256',
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      return 's' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch { /* insecure context / policy: fall through */ }
  }
  const h = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b9];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h[0] = Math.imul(h[0] ^ b, 0x01000193);
    h[1] = Math.imul(h[1] + b + i, 0x85ebca6b);
    h[2] = Math.imul(h[2] ^ (b + (i << 3)), 0xc2b2ae35);
    h[3] = Math.imul(h[3] ^ (b * 31 + i), 0x27d4eb2f);
  }
  return 'j' + h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('') + '-' + bytes.length.toString(16);
}

// Store WAV bytes and return their key, or null if nothing could be stored.
// `name` is what the inspector shows; `wave` is the fixed-size thumbnail, kept
// here rather than in the patch so that a sound and its picture share one
// lifetime — clearing the store leaves no waveform for audio that has gone —
// and so a share link doesn't carry ~2.8 KB of peaks per Source.
export async function putWav(bytes, name = '', wave = null) {
  if (!bytes?.length) return null;
  const db = await openDb();
  if (!db) return null;
  let key;
  try { key = await hashBytes(bytes); }
  catch (e) { return giveUp('audio store hash failed', e); }
  try {
    await tx(db, 'readwrite', (os) => {
      const get = os.get(key);
      get.onsuccess = () => {
        const prev = get.result;
        // Same bytes already here (a drag shares the array, a file re-picked):
        // don't rewrite the audio, just mark it used and keep the first name.
        os.put(prev
          ? { ...prev, ts: Date.now(), name: prev.name || name, wave: prev.wave || wave }
          : { key, bytes, len: bytes.length, name, wave, ts: Date.now() });
      };
    });
  } catch (e) {
    // A quota error is not a bug and not fatal — the patch simply keeps this
    // sound for the session only.
    if (e?.name === 'QuotaExceededError') { await prune(0); return null; }
    return giveUp('audio store write failed', e);
  }
  prune().catch(() => { /* pruning is best-effort */ });
  return key;
}

// The whole record — { bytes, wave, name, len } — or null if it isn't here
// (another machine, cleared store, pruned). One lookup gets a restoring Source
// both its waveform and its audio. Touches the record, so pruning treats it as
// recently used.
export async function getWav(key) {
  if (!key) return null;
  const db = await openDb();
  if (!db) return null;
  try {
    let rec;
    await tx(db, 'readwrite', (os) => {
      const get = os.get(key);
      get.onsuccess = () => {
        rec = get.result;
        if (rec) os.put({ ...rec, ts: Date.now() });
      };
    });
    if (!rec) return null;
    return {
      // Round-tripped through structured clone, so this may be an ArrayBuffer.
      bytes: rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes),
      wave: rec.wave || null,
      name: rec.name || '',
      len: rec.len || 0,
    };
  } catch (e) { return giveUp('audio store read failed', e); }
}

// Every record's metadata and thumbnail (but not its audio), newest first —
// what the inspector lists.
export async function listWavs() {
  const db = await openDb();
  if (!db) return [];
  try {
    const out = [];
    await tx(db, 'readonly', (os) => {
      const cur = os.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (!c) return;
        const { key, len, name, ts, wave } = c.value;
        out.push({ key, len, name, ts, wave: wave || null });
        c.continue();
      };
    });
    return out.sort((a, b) => b.ts - a.ts);
  } catch (e) { giveUp('audio store read failed', e); return []; }
}

export async function removeWav(key) {
  const db = await openDb();
  if (!db || !key) return false;
  try { await tx(db, 'readwrite', (os) => { os.delete(key); }); return true; }
  catch (e) { giveUp('audio store delete failed', e); return false; }
}

export async function clearWavs() {
  const db = await openDb();
  if (!db) return false;
  try { await tx(db, 'readwrite', (os) => { os.clear(); }); return true; }
  catch (e) { giveUp('audio store clear failed', e); return false; }
}

// { count, bytes } for the whole store.
export async function storeUsage() {
  const rows = await listWavs();
  return { count: rows.length, bytes: rows.reduce((a, r) => a + (r.len || 0), 0) };
}

// Drop least-recently-used records until the total fits under `cap`. Called after
// every write; a no-op in the normal case, since the pass stops as soon as the
// running total is under the cap.
async function prune(cap = CAP_BYTES) {
  const db = await openDb();
  if (!db) return;
  const rows = await listWavs();                       // newest first
  let total = 0;
  const doomed = [];
  for (const r of rows) {
    total += r.len || 0;
    if (total > cap) doomed.push(r.key);
  }
  if (!doomed.length) return;
  try { await tx(db, 'readwrite', (os) => { for (const k of doomed) os.delete(k); }); }
  catch (e) { giveUp('audio store prune failed', e); }
}
