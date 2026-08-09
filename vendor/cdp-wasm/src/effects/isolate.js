// Effect entries for CDP's `isolate` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { decodeAudio } from '../wav.js';

export default [
  {
    id: 'isolate.threshold', label: 'Isolate loud segments', category: 'Extend & segment',
    program: 'isolate', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['isolate', '3', '$IN', '$OUT', { p: 'dbon' }, { p: 'dboff' }, { p: 'splice', flag: '-s' }, { p: 'minms', flag: '-m' }],
    params: [
      { name: 'dbon', label: 'On level (dB)', min: -60, max: -1, default: -20, step: 1, minOf: (v) => Number(v.dboff) + 1, help: 'Level at which a segment is recognised to begin. Louder-only material above this starts a cut.' },
      { name: 'dboff', label: 'Off level (dB)', min: -90, max: -1, default: -40, step: 1, maxOf: (v) => Number(v.dbon) - 1, help: 'Level at which a recognised segment ends. Must be below the on-level.' },
      { name: 'splice', label: 'Splice (ms)', min: 0, max: 500, default: 15, step: 1, maxOf: (v) => Math.floor((Number(v.minms) - 1) / 2), help: 'Splice length at segment edges, in milliseconds.' },
      { name: 'minms', label: 'Min segment (ms)', min: 20, max: 500, default: 50, step: 1, minOf: (v) => 2 * Number(v.splice) + 1, help: 'Shortest segment to accept, in milliseconds (must exceed twice the splice).' },
    ],
    blurb: 'Extract the loud events from a mono sound into one file (they keep their original timing), plus a remnant file of the leftovers.',
  },
  {
    id: 'isolate.slices', label: 'Slice into pieces', category: 'Extend & segment',
    program: 'isolate', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    // Mode 4 needs a slicefile of increasing cut times; derive evenly-spaced
    // interior cuts from the source duration and the `pieces` parameter.
    args: ['isolate', '4', '$IN', '$OUT', '$DATA', { p: 'splice', flag: '-s' }],
    derive: (cdp, monoWav, v) => {
      const d = decodeAudio(monoWav);
      const dur = d.length / d.sampleRate;
      const pieces = Math.max(2, Math.round(v.pieces || 4));
      const cuts = [];
      for (let i = 1; i < pieces; i++) cuts.push((dur * i / pieces).toFixed(6));
      return cuts.join('\n') + '\n';
    },
    params: [
      { name: 'pieces', label: 'Pieces', min: 2, max: 16, default: 4, step: 1, help: 'How many equal pieces to cut the sound into. Each piece becomes its own file.' },
      { name: 'splice', label: 'Splice (ms)', min: 0, max: 500, default: 15, step: 1, help: 'Splice length at the cut points, in milliseconds.' },
    ],
    blurb: 'Cut a mono sound into equal-length pieces, each written to its own file.',
  },
];
