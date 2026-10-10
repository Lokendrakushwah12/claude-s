// THE creative file. Replace this demo with the storyboard from treatment.md, using the product's real brand.
// Colours must be #rrggbb (the helpers append alpha). Lay out with W/H so --size 1080x1920 still works.
const B = { bg: '#050505', fg: '#fafafa', accent: '#ff5a1f', blue: '#3b82f6', green: '#22c55e', violet: '#8b5cf6', font: 'Inter', name: 'acme' };
const S = Math.min(W, H) / 1080; // scale factor so sizes hold up in every aspect ratio
const DATA = series(70, 7);

window.VIDEO = {
  duration: 8,
  audio: 'audio.wav',             // written by sfx.py from `sfx` (+ `music`)
  music: null,                    // e.g. 'music.mp3': a licensed track, mixed under the SFX
  fonts: ['Inter:wght@400;600;700;800'],
  assets: [],                     // e.g. ['logo.svg', 'dashboard.png'] copied from the product repo / screenshots
  sfx: [[0.05, 'tick'], [1.6, 'whoosh'], [1.9, 'pop'], [4.0, 'thud'], [4.5, 'thud'], [5.0, 'thud'], [5.9, 'whoosh'], [6.2, 'chime']],
  scenes: [
    { start: 0, end: 1.9, draw(c, p, t) { // hook: the URL gets typed
      bg(c, B.bg); glow(c, W / 2, H * 1.1, H * 0.9, B.accent, 0.35);
      c.save(); c.font = `600 ${56 * S}px Inter`; const w = c.measureText('acme.com/launch').width; c.restore();
      typewriter(c, 'acme.com/launch', t, 0.1, W / 2 - w / 2, H / 2, { size: 56 * S, font: B.font, weight: 600, color: B.fg, caret: B.accent, cps: 14 });
    } },
    { start: 1.9, end: 4.0, draw(c, p, t) { // product moment: dashboard card with a rolling counter + chart
      bg(c, B.bg); glow(c, W / 2, H / 2, H, B.blue, 0.25);
      const e = spring(prog(t, 1.9, 2.5)), cw = W * 0.7, ch = H * 0.55, x = (W - cw) / 2, y = (H - ch) / 2 + (1 - e) * 80 * S;
      c.globalAlpha = clamp(e * 1.5); card(c, x, y, cw, ch);
      text(c, 'Clicks', x + 40 * S, y + 50 * S, { size: 24 * S, font: B.font, color: '#8a8a8f', align: 'left' });
      counter(c, lerp(12840, 1284093, ease.out(prog(t, 2.0, 3.8))), x + 40 * S, y + 110 * S, { size: 64 * S, font: B.font, color: B.fg, align: 'left' });
      lineChart(c, DATA, x + 40 * S, y + 170 * S, cw - 80 * S, ch - 210 * S, ease.inOut(prog(t, 2.1, 3.9)), { color: B.blue });
    } },
    ...[['Short links.', '#ffffff', '#0a0a0a'], ['Analytics.', B.accent, '#0a0a0a'], ['Payouts.', B.bg, B.green]].map(([word, bgc, fg], i) => ({
      start: 4.0 + i * 0.5, end: 4.5 + i * 0.5, draw(c, p, t) { // fast feature cuts, one per beat
        bg(c, bgc); text(c, word, W / 2, H / 2, { size: 150 * S, font: B.font, weight: 800, color: fg, spacing: -4 * S, scale: lerp(1.06, 1, ease.out(p)) });
      } })),
    { start: 5.5, end: 8, draw(c, p, t) { // end card: logo lockup, tagline, CTA
      bg(c, '#ffffff'); mesh(c, ['#ffffff', '#ffd1b3', '#c7d2fe', '#fbcfe8'], t); c.globalAlpha = 1;
      const e = spring(prog(t, 5.6, 6.3));
      text(c, B.name, W / 2, H / 2 - 60 * S, { size: 130 * S, font: B.font, weight: 800, color: '#0a0a0a', spacing: -5 * S, scale: lerp(0.9, 1, e), alpha: clamp(e * 2) });
      text(c, 'Turn clicks into revenue.', W / 2, H / 2 + 50 * S, { size: 44 * S, font: B.font, weight: 500, color: '#3f3f46', alpha: prog(t, 6.1, 6.5) });
      pill(c, 'Start for free →', W / 2, H / 2 + 150 * S, { size: 26 * S, font: B.font, fill: '#0a0a0a', alpha: prog(t, 6.4, 6.8) });
    } },
  ],
};
