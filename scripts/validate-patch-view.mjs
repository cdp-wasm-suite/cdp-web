import assert from 'node:assert/strict';
import { resolvePatchView } from '../src/core/patch-view.js';

assert.deepEqual(resolvePatchView({}), { arrange: false, fit: false });
assert.deepEqual(resolvePatchView({ view: { arrange: true, fit: true } }), { arrange: true, fit: true });
assert.deepEqual(
  resolvePatchView({ view: { arrange: true, fit: true } }, { arrange: false }),
  { arrange: false, fit: true },
);
assert.deepEqual(
  resolvePatchView({ view: { arrange: false, fit: false } }, { arrange: true, fit: true }),
  { arrange: true, fit: true },
);
assert.deepEqual(resolvePatchView({ view: 'invalid' }), { arrange: false, fit: false });

console.log('patch view: OK — hints and explicit load overrides');
