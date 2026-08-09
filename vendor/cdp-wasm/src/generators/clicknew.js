// Generator entry for CDP's `clicknew` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  { id: 'clicks', label: 'Click track', category: 'Synthesis', program: 'clicknew', mode: ['clicks'],
    args: ['clicks', '$OUT', '$DATA', '$SR'],
    params: [],
    data: { label: 'Click times in seconds (one per line)', placeholder: 'e.g. 0 / 0.5 / 1.0 / 1.5', default: '0\n0.5\n1.0\n1.5\n2.0' },
    parityExempt: 'clicknew impulse timing differs across platforms',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#CLICKNEW',
    blurb: 'Clicktrack with a click at each listed time — good for triggering grains.' },
];
