// Main-thread handle on the CDP engine, running the engine in a worker so
// synchronous callMain renders never freeze the UI (see cdp-worker.js). The
// proxy exposes the same async API as the CDP class — every call site already
// awaits, so it drops in unchanged. If the worker can't start (exotic
// embedding), calls fall back to an inline CDP instance, same as before.
//
// eachChannel is the one callback-taking method; its orchestration is pure JS
// (split channels → fn → recombine, no engine state), so it runs here and the
// per-channel work the callback does still routes through the worker.
import { CDP } from 'cdp-wasm';

export function createCdp() {
  let worker = null, seq = 0;
  const pending = new Map();
  let inline = null;   // lazy fallback engine (never constructed if the worker works)
  const fallback = () => (inline ||= new CDP());

  function call(method, args) {
    return new Promise((resolve, reject) => {
      if (worker === 'dead') { reject(Object.assign(new Error('CDP worker unavailable'), { workerDown: true })); return; }
      if (!worker) {
        try { worker = new Worker(new URL('./cdp-worker.js', import.meta.url), { type: 'module' }); }
        catch (e) { worker = 'dead'; reject(Object.assign(e, { workerDown: true })); return; }
        worker.onmessage = (e) => {
          const { id, result, error } = e.data;
          const p = pending.get(id); if (!p) return;
          pending.delete(id);
          error ? p.reject(new Error(error)) : p.resolve(result);
        };
        worker.onerror = (e) => {   // load/parse failure — fail pending calls, disable the worker path
          for (const p of pending.values()) p.reject(Object.assign(new Error('CDP worker failed: ' + (e.message || 'error')), { workerDown: true }));
          pending.clear();
          try { worker.terminate(); } catch {}
          worker = 'dead';
        };
      }
      const id = ++seq;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, method, args });
    });
  }

  const rpc = (method) => async (...args) => {
    if (inline) return inline[method](...args);   // worker already proved unusable
    try { return await call(method, args); }
    catch (e) {
      if (!e.workerDown) throw e;                 // engine error — report it as-is
      return fallback()[method](...args);
    }
  };

  const proxy = {
    run: rpc('run'),
    process: rpc('process'),
    processWav: rpc('processWav'),
    load: rpc('load'),
    programs: rpc('programs'),
    spectralPrograms: rpc('spectralPrograms'),
    eachChannel(wav, fn) { return CDP.prototype.eachChannel.call(proxy, wav, fn); },
  };
  return proxy;
}
