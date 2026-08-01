// Phase 0 spike. The lock-step capture advances a paused virtual clock one frame
// at a time and screenshots each step. That only works if page.clock also fakes
// requestAnimationFrame -- the app animates cables and playheads on rAF, and if
// rAF still runs on the real clock those animations drift against the frames we
// capture. Settle it empirically rather than trusting the docs.
//
//   faked     -> rafCount ~= 60 over 1000ms of virtual time, lastTimestamp ~= 1000
//   not faked -> rafCount stays 1 (the initial call), lastTimestamp stays 0
//
// If not faked, the fallback is Puppeteer + CDP Emulation.setVirtualTimePolicy,
// which drives the document timeline too (and would also make CSS animations
// deterministic).

import { chromium } from 'playwright';

const PAGE = `<!doctype html><meta charset=utf-8><script>
  window.rafCount = 0;
  window.lastTimestamp = 0;
  (function loop(t) {
    window.rafCount++;
    window.lastTimestamp = t;
    requestAnimationFrame(loop);
  })(0);
  // A plain timer as a control: page.clock definitely fakes these, so if the
  // timer advances but rAF doesn't, we know rAF specifically is unfaked rather
  // than the clock being broken.
  window.timerCount = 0;
  setInterval(() => { window.timerCount++; }, 100);
</script>`;

const browser = await chromium.launch();
const page = await browser.newPage();

await page.clock.install({ time: 0 });
await page.setContent(PAGE);

// runFor, not fastForward: fastForward coalesces repeated timers and would skip
// the intermediate frames we care about.
await page.clock.runFor(1000);

const r = await page.evaluate(() => ({
  rafCount: window.rafCount,
  lastTimestamp: window.lastTimestamp,
  timerCount: window.timerCount,
}));
await browser.close();

const rafFaked = r.rafCount > 30;
const timersFaked = r.timerCount >= 9;

console.log('playwright:', (await import('playwright/package.json', { with: { type: 'json' } })).default.version);
console.log('after clock.runFor(1000):', r);
console.log('');
console.log('  timers faked:', timersFaked ? 'YES' : 'NO', `(timerCount=${r.timerCount}, expected ~10)`);
console.log('  rAF faked:   ', rafFaked ? 'YES' : 'NO', `(rafCount=${r.rafCount}, expected ~60)`);
console.log('');
console.log(rafFaked
  ? 'PASS -> lock-step capture via page.clock is viable.'
  : 'FAIL -> fall back to Puppeteer + Emulation.setVirtualTimePolicy.');

process.exit(rafFaked ? 0 : 1);
