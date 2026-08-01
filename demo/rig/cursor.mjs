// Playwright's real mouse never appears in page.screenshot(), but its
// move/down/up dispatch trusted events that the app's own drag logic listens to.
// So we keep driving the real mouse and paint a cosmetic cursor that follows it.
//
// pointer-events:none is load-bearing -- the overlay must never intercept an
// event the patcher is waiting for. Injected via addInitScript so it exists
// before app JS and survives reloads.

const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path d="M5 2 L5 19 L9.5 14.8 L12.3 21 L15.2 19.6 L12.5 13.7 L18.5 13.4 Z"
        fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

export async function installCursor(context) {
  await context.addInitScript((svg) => {
    // Defensive: the app reads localStorage on load and would restore the last
    // session's graph. A fresh context is already empty, but a scene may reload
    // the page mid-capture, and persist() debounces writes at 400ms.
    try { localStorage.clear(); } catch { /* storage disabled */ }

    const mount = () => {
      if (document.getElementById('__demoCursor')) return;

      const cursor = document.createElement('div');
      cursor.id = '__demoCursor';
      Object.assign(cursor.style, {
        position: 'fixed', left: '0', top: '0', width: '24px', height: '24px',
        zIndex: '2147483647',        // above the CRT overlay (99999) and popovers
        pointerEvents: 'none',       // never steal an event from the app
        transition: 'none',
        willChange: 'transform',
        transformOrigin: '4px 3px',  // the arrow tip, so scaling pivots there
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))',
      });
      cursor.innerHTML = svg;

      // Click ripple: a short expanding ring, driven by a CSS animation. The
      // clock fakes rAF but NOT CSS/document-timeline animations, so this would
      // freeze under lock-step. Drive it off the frame counter instead.
      const ring = document.createElement('div');
      ring.id = '__demoRing';
      Object.assign(ring.style, {
        position: 'fixed', left: '0', top: '0', width: '0', height: '0',
        border: '2px solid rgba(255,255,255,.9)', borderRadius: '50%',
        zIndex: '2147483646', pointerEvents: 'none', opacity: '0',
      });

      let x = 0, y = 0, down = false;
      // Ripple progress in frames, advanced by the rig's step() via
      // __demoTickCursor() so it stays in lockstep with the virtual clock.
      let ripple = -1;
      const RIPPLE_FRAMES = 12;

      const paint = () => {
        cursor.style.transform = `translate(${x - 4}px, ${y - 3}px) scale(${down ? 0.82 : 1})`;
        if (ripple >= 0 && ripple <= RIPPLE_FRAMES) {
          const t = ripple / RIPPLE_FRAMES;
          const r = 6 + t * 22;
          Object.assign(ring.style, {
            left: `${x - r}px`, top: `${y - r}px`,
            width: `${r * 2}px`, height: `${r * 2}px`,
            opacity: String(1 - t),
          });
        } else {
          ring.style.opacity = '0';
        }
      };

      addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; paint(); }, { capture: true });
      addEventListener('mousedown', (e) => { x = e.clientX; y = e.clientY; down = true; ripple = 0; paint(); }, { capture: true });
      addEventListener('mouseup',   (e) => { x = e.clientX; y = e.clientY; down = false; paint(); }, { capture: true });

      // Called once per captured frame by clock.step().
      window.__demoTickCursor = () => { if (ripple >= 0) ripple++; paint(); };
      window.__demoCursorAt = () => ({ x, y });

      document.body.append(ring, cursor);
      paint();
    };

    if (document.body) mount();
    else addEventListener('DOMContentLoaded', mount, { once: true });
  }, CURSOR_SVG);
}
