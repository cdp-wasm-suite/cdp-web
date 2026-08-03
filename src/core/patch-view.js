// Resolve one-shot presentation hints carried by imported/programmatic patches.
// Explicit loadPatch options win, so recipes, undo/redo and host integrations can
// keep choosing their own behaviour. The hints are deliberately not serialized:
// once opened, the arranged coordinates become ordinary user-editable patch state.
export function resolvePatchView(data, options = {}) {
  const view = data?.view && typeof data.view === 'object' ? data.view : {};
  return {
    arrange: options.arrange ?? view.arrange === true,
    fit: options.fit ?? view.fit === true,
  };
}
