// Frame writer. Screenshots are the slow part of a capture, so disk writes are
// fired off without awaiting and drained at the end; the browser is the
// bottleneck, not the SSD.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export function createCapture(page, { outDir, framePattern = 'frame-%06d.png', clean = true } = {}) {
  const frameDir = join(outDir, 'frames');
  if (clean) rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  let n = 0;
  const pending = [];

  const name = (i) => framePattern.replace('%06d', String(i).padStart(6, '0'));

  return {
    get frame() { return n; },

    /** Screenshot the current state as the next frame. */
    async snap() {
      const buf = await page.screenshot({ type: 'png', animations: 'disabled' });
      const p = join(frameDir, name(n));
      n++;
      pending.push(Promise.resolve().then(() => writeFileSync(p, buf)));
      // Bound the queue so a long capture can't balloon memory holding buffers.
      if (pending.length >= 32) { await Promise.all(pending.splice(0)); }
      return n - 1;
    },

    async drain() {
      await Promise.all(pending.splice(0));
      return n;
    },
  };
}
