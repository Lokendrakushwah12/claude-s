// <Brand> — <one-line logline from docs/concept.md>
// References and what was TAKEN from each (techniques only, never shots): see docs/grammar.md
// Devices invented for this film (in no reference): <list>
// <BPM> BPM: beat <60/BPM> s. Every scene start is on a beat.
const B = { paper: '#F6F5F0', ink: '#0A0A0B', accent: '#FFEC42', mute: '#8E8D87' }; // from the brand's CSS / logo, hex only
Object.assign(TYPE, { display: 'Inter Tight', ui: 'Inter', mono: 'IBM Plex Mono', weight: 500, track: -0.03 }); // the brand's fonts

window.VIDEO = {
  duration: 4,
  audio: 'audio.wav',
  fonts: ['Inter Tight:wght@400;500;600;700', 'Inter:wght@400;500;600', 'IBM Plex Mono:wght@500;600'],
  assets: [], // e.g. 'wordmark-white.svg' downloaded from the brand's site
  bed: { bpm: 100, sections: [[0, 'intro'], [2.4, 'end']], chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]] },
  sfx: [[0.6, 'blip'], [2.4, 'chime']],
  overlay(c, t) { grain(c, t, 0.04); },
  scenes: [
    // One scene per shot in docs/shotlist.md. Write each as: technique × brand object × real copy.
    { start: 0, end: 4, draw(c, p, t) {
      bg(c, B.paper);
      words(c, 'Replace me with the first line of the story.', W / 2, H / 2, t - 0.3, { size: 52 * S, font: TYPE.ui, color: B.ink });
    } },
  ],
};
