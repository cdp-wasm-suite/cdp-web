// Virtual time. Everything the app animates on rAF or a timer advances only when
// we say so, which is what makes a 20-second WASM render cost zero video frames.
//
// Two rules, both learned the hard way:
//   * install AFTER window.__cdpReady. The readiness poll (patcher.js:2615) and
//     host-bridge.js:108 run on real timers and stall if time is frozen first.
//   * never settle a frame with in-page requestAnimationFrame. It's faked now,
//     so it won't fire until the next runFor() -- you'd deadlock. Node timers
//     (page.waitForTimeout) are unaffected by the page clock.

export function createClock(page, { fps = 30, mode = 'lockstep' } = {}) {
  const stepMs = 1000 / fps;
  let installed = false;

  return {
    fps,
    mode,

    async install() {
      if (mode !== 'lockstep') return;
      await page.clock.install({ time: 0 });
      installed = true;
    },

    /** Advance exactly one frame of virtual time. */
    async step() {
      if (mode === 'lockstep') {
        if (!installed) throw new Error('clock.step() before clock.install()');
        // runFor, not fastForward: fastForward coalesces repeated timers and
        // would skip the intermediate rAF callbacks the animation depends on.
        await page.clock.runFor(stepMs);
      } else {
        await page.waitForTimeout(stepMs);
      }
      // Advance the synthetic cursor's ripple in lockstep (it can't use a CSS
      // animation -- the clock doesn't fake the document timeline).
      await page.evaluate(() => window.__demoTickCursor?.());
    },

    /**
     * Let real wall-clock time pass without advancing virtual time. Needed for
     * the things the page clock cannot reach: Web Workers (the waveform editor
     * draws in one via setTimeout(0), waveform-worker.js:55) and AudioWorklets.
     */
    async settleReal(ms = 120) {
      await page.waitForTimeout(ms);
    },
  };
}
