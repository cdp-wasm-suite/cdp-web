// Effect entry for CDP's `packet` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { conformChannels, requireOutput } from './helpers.js';

export default [
  {
    id: 'packet.make', label: 'Sound packet', category: 'Synthesis',
    program: 'packet', domain: 'sound',
    // Mode 2: force a packet (enveloped grain) at a given time. packet numbers its
    // outputs (out.wav -> out0.wav), so run it directly and read the first packet.
    pipeline: async (cdp, src, v) => {
      const mono = conformChannels(src, 'mono');
      const args = ['packet', '2', '/in.wav', '/out.wav', String(v.time), String(v.dur), String(v.narrowing), String(v.centring)];
      const res = await cdp.run('packet', args, { inputs: { '/in.wav': mono }, outputs: ['/out0.wav'] });
      return requireOutput(res, res.outputs['/out0.wav'], 'packet');
    },
    params: [
      { name: 'time', label: 'Packet at (s)', min: 0, max: 60, default: 0.2, step: 0.01, help: 'Time in the source where the packet is created, in seconds.' },
      { name: 'dur', label: 'Packet (ms)', min: 1, max: 200, default: 80, step: 1, help: 'Duration of the packet, in milliseconds (less than half the source length).' },
      { name: 'narrowing', label: 'Narrowing', min: 0, max: 1000, default: 1, step: 0.5, help: 'Sharpness of the packet envelope. Below 1 broadens it; high values narrow it (very high values can click).' },
      { name: 'centring', label: 'Peak centring', min: -1, max: 1, default: 0, step: 0.1, help: 'Where the envelope peak sits: 0 centre, -1 at the start, 1 at the end.' },
    ],
    blurb: 'Isolate/shape one enveloped sound packet (a short grain) from the source.',
  },
];
