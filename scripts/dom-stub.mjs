// Minimal DOM stub so the app's UI modules import cleanly under Node. Import
// this FIRST (before anything that reaches src/ui/) — ESM evaluates imports
// before the importer's body, so inline stubs run too late. The DOM use in
// those modules is inside functions the headless scripts never call; the one
// exception is popover-fallback.js's import-time feature check, which the
// HTMLElement stub below makes early-return.
globalThis.document ??= { getElementById: () => null, createElement: () => ({ style: {} }), createElementNS: () => ({ style: {} }), addEventListener: () => {}, body: { appendChild: () => {} } };
globalThis.addEventListener ??= () => {};
globalThis.HTMLElement ??= class {};
if (!('popover' in HTMLElement.prototype)) HTMLElement.prototype.popover = null;
