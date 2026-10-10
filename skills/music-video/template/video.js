// THE creative file. Replace these demo scenes with the shot list from treatment.md.
// Each scene: { start, end, draw(ctx, p, t, scene) }. p = 0..1 through the scene, t = song time in seconds.
// Scenes can overlap; later ones draw on top. Everything must be a pure function of t (see lib.js).
const INK = '#1d1a2e', PAPER_C = '#efe6d3', HOT = '#ff4f9a', SUN = '#ff7a2f';

window.VIDEO = {
  duration: 6,                    // set to the song length (align.py prints it)
  audio: '',                      // e.g. 'song.mp3', relative to this folder
  fonts: ['Anton', 'Instrument Serif:ital@0;1'],
  assets: [],                     // files in assets/, e.g. ['hero.png', 'set-city.png']; use with img('hero.png')
  scenes: [
    { start: 0, end: 3, draw(c, p, t) { // hook: giant kinetic lyric
      bg(c, PAPER_C);
      const [dx, dy] = wobble(1, t, 4);
      kinetic(c, lyricAt(t), t, { x: W / 2 + dx, y: H / 2 + dy, size: 260, color: INK });
    } },
    { start: 3, end: 6, draw(c, p, t) { // sunburst + character stand-in + subtitle lyric
      bg(c, INK);
      c.translate(W * 0.68, H / 2); c.rotate(t * 0.2);
      for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.fillStyle = i % 2 ? HOT : SUN; c.beginPath(); c.moveTo(0, 0); c.lineTo(2000, -140); c.lineTo(2000, 140); c.fill(); }
      c.setTransform(1, 0, 0, 1, 0, 0);
      const r = 180 * (1 + 0.08 * pulse(t));
      c.fillStyle = PAPER_C; c.beginPath(); c.arc(W * 0.68, H / 2, r, 0, 7); c.fill();
      text(c, lyricAt(t)?.text || '', 120, H - 110, { size: 64, font: 'Instrument Serif', italic: true, color: PAPER_C, align: 'left' });
    } },
  ],
  overlay(c, t) { paper(c, 0.55); }, // paper grain on everything
};
