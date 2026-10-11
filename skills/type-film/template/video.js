// <Brand> — <one-line logline from docs/concept.md>
// References and what was TAKEN from each (techniques only, never shots): see docs/grammar.md
// Devices invented for this film (in no reference): <list>
// <BPM> BPM: beat <60/BPM> s. Every scene start is on a beat.
const B = { paper: '#F6F5F0', ink: '#0A0A0B', accent: '#FFEC42', mute: '#8E8D87' }; // from the brand's CSS / logo, hex only
Object.assign(TYPE, { display: 'Inter Tight', ui: 'Inter', mono: 'IBM Plex Mono', serif: 'Instrument Serif', weight: 800, track: -0.02 }); // the brand's fonts; display at 800-900

window.VIDEO = {
  duration: 4,
  audio: 'audio.wav',
  fonts: ['Inter Tight:wght@400;500;600;700;800;900', 'Inter:wght@400;500;600', 'IBM Plex Mono:wght@500;600', 'Instrument Serif:ital@0;1'],
  assets: [], // e.g. 'wordmark-white.svg' downloaded from the brand's site
  bed: { bpm: 100, sections: [[0, 'intro'], [2.4, 'end']], chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]] },
  sfx: [[0.6, 'blip'], [2.4, 'chime']],
  overlay(c, t) { grain(c, t, 0.04); },
  scenes: [
    // One scene per shot in docs/shotlist.md. Write each as: technique × brand object × real copy.
    { start: 0, end: 4, draw(c, p, t) {
      litGround(c, B.paper, 0.5);
      // Sizes by cap height (SKILL.md "Type craft"): the lead 6-9 % of H in a second voice, the hero 18-40 %, set by its ink.
      const r = fitStack(c, ['REPLACE ME'], 0.08 * W, 0.42 * H, 0.84 * W)[0];
      rise(c, 'the line said around it,', 0.08 * W, 0.34 * H, spr(t - 0.2, 300, 26), { size: 0.12 * H, font: TYPE.serif, weight: 'italic 400', track: 0, color: B.ink });
      hitWord(c, r.s, r.x, r.y, t - 0.5, { size: r.size, color: B.ink });
    } },
  ],
};
