// Effect entry for CDP's `wrappage` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'wrappage.wrappage', label: 'Wrappage (spatial brassage)', category: 'Granular',
    program: 'wrappage', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // 21 positional params. `centre` and `depth` are exposed (the spatial pair
    // that governs multichannel coverage): with `spread` open to 8, a pinned low
    // `depth` left the channels behind the spread's leading edges silent. `depth`
    // defaults to 4 and CDP floors it internally to spread/2, so the full spread
    // is filled at any width while narrow spreads keep their soft character.
    // Still pinned (see fixedParams): grain amp 0.7 (headroom for overlapped
    // grains), start/end splices 5 ms, search range 50 ms, jitter 0.5 — the
    // classic soft granular blur. Each h-variant repeats its base param, so no
    // extra random range opens up. outlength is always supplied because veloc may
    // be 0 (freeze). The outfile name must not end in '1' — /out.wav is fine.
    args: ['wrappage', '$IN', '$OUT', { p: 'centre' }, { p: 'chans' }, { p: 'spread' }, { p: 'depth' },
      { p: 'veloc' }, { p: 'veloc' }, { p: 'dens' }, { p: 'dens' },
      { p: 'gsize' }, { p: 'gsize' }, { p: 'pshift' }, { p: 'pshift' },
      '0.7', '0.7', '5', '5', '5', '5', '50', '0.5', { p: 'outlength' }],
    params: [
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, help: 'Number of output channels the grains are spread across.' },
      { name: 'spread', label: 'Spread (chans)', min: 0, max: 8, default: 2, step: 1, help: 'Width of the spatial image, in channels. 2 fills a stereo pair; larger values wrap further round a multichannel rig.' },
      { name: 'centre', label: 'Centre (chan)', min: 0, max: 8, default: 1, step: 1, maxOf: (v) => Number(v.chans), help: 'Central position of the spatial image on the channel ring (0–chans). Values below 1 sit between the last and first channel.' },
      { name: 'depth', label: 'Depth (chans)', min: 0, max: 4, default: 4, step: 1, help: 'How many channels behind the spread’s leading edges are filled with sound. CDP caps this at half the spread, so the default fills the whole spread at any width; lower it to leave spatial gaps.' },
      { name: 'veloc', label: 'Read speed ×', min: 0, max: 2, default: 1, step: 0.05, help: 'Speed of advance through the source: 1 is natural speed, 0.5 doubles the length, 0 freezes on one spot for the whole output.' },
      { name: 'dens', label: 'Density', min: 0.25, max: 4, default: 2, step: 0.25, help: 'Grain overlap. Below 1 leaves silence between grains; higher stacks more grains and gets noticeably louder.' },
      { name: 'gsize', label: 'Grain (ms)', min: 12, max: 200, default: 50, step: 1, help: 'Grain size in milliseconds. Smaller is grittier, larger smoother.' },
      { name: 'pshift', label: 'Pitch shift (st)', min: -12, max: 12, default: 0, step: 0.5, help: 'Pitch shift of the grains, in semitones.' },
      { name: 'outlength', label: 'Max length (s)', min: 1, max: 20, default: 4, step: 0.5, help: 'Cap on the output length, in seconds. Sets the length outright when Read speed is 0 (freeze).' },
    ],
    // Positional CDP params pinned by this wrapper (surfaced by describe-effect as
    // read-only). Override them via raw cdp.run — see references/raw-programs.md.
    fixedParams: [
      { name: 'amp', value: 0.7, help: 'Grain gain — headroom for overlapped grains (raw params 16–17: amp/hamp).' },
      { name: 'bsplice/esplice', value: 5, help: 'Grain start/end splice length, in ms (raw params 18–21).' },
      { name: 'range', value: 50, help: 'Search range for the next grain, in ms (raw param 22).' },
      { name: 'jitter', value: 0.5, help: 'Randomisation of grain position, 0–1 (raw param 23).' },
    ],
    blurb: 'Granulate the source and scatter the grains over a multichannel field, with time-stretch or freeze and pitch shift.',
  },
];
