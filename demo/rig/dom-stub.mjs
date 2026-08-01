// Enough DOM for src/core/graph.js and its transitive imports to load in Node.
//
// Must be a separate module imported BEFORE anything that pulls in src/ui/ui.js:
// static ESM imports are evaluated before the importing module's body runs, so
// assigning these globals inline at the top of a script is too late.
// (scripts/dom-stub.mjs is the app-side twin — demo/ stays a self-contained
// package, so the few lines are duplicated rather than imported across.)

const classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };

globalThis.document ??= {
  getElementById: () => null,
  createElement: () => ({ style: {} }),
  createElementNS: () => ({ style: {} }),
  querySelector: () => null,
  addEventListener: () => {},
  body: { appendChild: () => {} },
  documentElement: { classList, style: { setProperty: () => {} } },
};
globalThis.addEventListener ??= () => {};

// ui.js -> popover-fallback.js reads HTMLElement.prototype at module scope, and
// installs a fallback unless `popover` is supported. Claim support so it returns
// early rather than walking a DOM we haven't stubbed.
globalThis.HTMLElement ??= class HTMLElement {};
if (!('popover' in globalThis.HTMLElement.prototype)) {
  Object.defineProperty(globalThis.HTMLElement.prototype, 'popover', { value: null, writable: true });
}
