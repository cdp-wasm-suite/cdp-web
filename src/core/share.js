// Share-link codec: a whole patch travels in the URL fragment as
//   #patch=<base64url(deflate-raw(JSON))>
// Param-style hash, coexisting with the reserved #cdpHost= session hash
// (host-bridge.js). The fragment never reaches the server (nothing logged, no
// 404 risk on the GH Pages subpath) and base64url survives chat apps and URL
// re-encoders. deflate-raw needs CompressionStream/DecompressionStream
// (evergreen browsers since ~2023) — callers gate on shareSupported().

export function shareSupported() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

const bytesToB64url = (bytes) => {
  let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlToBytes = (b64url) => {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const pump = (bytes, stream) => new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();

export async function encodeShare(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  return bytesToB64url(new Uint8Array(await pump(raw, new CompressionStream('deflate-raw'))));
}

// Throws on any failure (truncated link, corrupt base64, not JSON).
export async function decodeShare(str) {
  const raw = await pump(b64urlToBytes(str), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(raw));
}

// The payload out of anything carrying one: this page's hash, or a whole link
// pasted in from elsewhere (which is how a link reaches an app on an iOS home
// screen — iOS opens links in the browser, never in an installed web app).
// Anchored to a delimiter so a stray "…mypatch=" can't be mistaken for one.
export function shareParamFromText(text) {
  const m = /(?:^|[#&?])patch=([^&\s]+)/.exec(String(text || ''));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getShareParam() {
  return shareParamFromText(location.hash || '');
}

// Drop only the patch= segment, preserving the query and any other hash
// segments (a co-present cdpHost= must survive).
export function stripShareParam() {
  const rest = (location.hash || '').replace(/^#/, '').split('&').filter((s) => s && !/^patch=/.test(s));
  history.replaceState(null, '', location.pathname + location.search + (rest.length ? '#' + rest.join('&') : ''));
}
