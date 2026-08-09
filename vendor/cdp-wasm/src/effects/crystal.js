// Effect entry for CDP's `crystal` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { crystalData } from './helpers.js';

export default [
  {
    id: 'crystal.rotate', label: 'Crystal (rotating vertices)', category: 'Texture',
    program: 'crystal', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'event times/pitches from 3-D rotation trig round to sample indices; libm ulp differences can shift whole events',
    // Mode 2 (stereo output). X -> time & stereo position, Y -> pitch, Z ->
    // brightness (far = lowpassed, close = octave-up stack).
    args: ['rotate', '2', '$IN', '$OUT', '$DATA', { p: 'rota' }, { p: 'rotb' },
      { p: 'twidth' }, { p: 'tstep' }, { p: 'dur' }, { p: 'plo' }, { p: 'phi' }],
    data: crystalData,
    params: [
      { name: 'dur', label: 'Duration (s)', min: 1, max: 20, default: 6, step: 0.5, help: 'Length of the generated texture, in seconds.' },
      { name: 'verts', label: 'Vertices', min: 3, max: 8, default: 4, step: 1, help: 'Number of crystal vertices — each vertex generates one event per rotation step.' },
      { name: 'radius', label: 'Crystal size', min: 0.2, max: 0.9, default: 0.7, step: 0.05, help: 'How far the vertices sit from the centre (0–1). Larger spreads the events wider in time, pitch and brightness.' },
      { name: 'seed', label: 'Layout seed', min: 1, max: 99, default: 1, step: 1, help: 'Picks the vertex layout. The same seed always gives the same crystal.' },
      { name: 'rota', label: 'Spin xy (rev/s)', min: -10, max: 10, default: 0.4, step: 0.1, help: 'Rotation speed in the time/pitch plane, in revolutions per second.' },
      { name: 'rotb', label: 'Spin xz (rev/s)', min: -10, max: 10, default: 0.25, step: 0.05, help: 'Rotation speed in the time/brightness plane, in revolutions per second.' },
      { name: 'twidth', label: 'Group width (s)', min: 0.05, max: 1, default: 0.5, step: 0.05, help: 'Longest time between the first and last event of one vertex-group, in seconds.' },
      { name: 'tstep', label: 'Group step (s)', min: 0.05, max: 1, default: 0.3, step: 0.05, help: 'Time between successive samplings of the rotating crystal, in seconds. Smaller gives denser groups.' },
      { name: 'plo', label: 'Min pitch (MIDI)', min: 24, max: 48, default: 48, step: 1, help: 'Lowest pitch an event can take (MIDI note; 48 = C3).' },
      { name: 'phi', label: 'Max pitch (MIDI)', min: 72, max: 96, default: 72, step: 1, help: 'Highest pitch an event can take (MIDI note; 72 = C5).' },
      { name: 'attack', label: 'Event attack (s)', min: 0.005, max: 0.5, default: 0.03, step: 0.005, help: 'Rise time of each event’s envelope, in seconds.' },
      { name: 'decay', label: 'Event decay (s)', min: 0.05, max: 2, default: 0.35, step: 0.05, help: 'Fall time of each event’s envelope, in seconds. Attack + decay is the event length.' },
    ],
    blurb: 'Rotate a crystal of vertices in 3-D; each vertex fires an event whose stereo position, pitch and brightness trace the rotation.',
  },
];
