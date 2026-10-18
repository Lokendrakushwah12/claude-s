// Gallery demos: one short, pure-in-t sketch per toolkit device, drawn at 540x960 (S = 0.5).
// IDs are stable: append new demos at the end, never renumber. `ask` is how to ask Claude for the device.
const DEMOS = [];
let _n = 0;
const add = (group, file, helper, name, ask, cycle, draw) => DEMOS.push({ id: 'T' + String(++_n).padStart(3, '0'), name, helper, file, group, ask, cycle, draw });
const cx = W / 2, cy = H / 2, pp = (t, c) => 0.5 - 0.5 * Math.cos((t / c) * Math.PI * 2); // ping-pong 0..1..0 over a cycle
const dark = c => bg(c, '#0E0E10'), light = c => bg(c, '#F4F3EF');
const big = { color: '#fff', align: 'center' };
const scene = (c, t) => { // a stand-in picture for the looks
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d3557'); g.addColorStop(1, '#e76f51'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#f1faee'; c.beginPath(); c.arc(cx, H * 0.38 + 20 * Math.sin(t * 2), 110, 0, 7); c.fill();
  word(c, 'LOOK', cx, H * 0.78, { size: 150, weight: 900, ...big });
};
const sceneB = c => { bg(c, '#ff5a1f'); word(c, 'NEXT', cx, cy + 40, { size: 130, weight: 900, color: '#111', align: 'center' }); };
const sceneA = c => { dark(c); word(c, 'SHOT A', cx, cy + 40, { size: 110, ...big }); };
const set3d = (c, k) => { dark(c); floor3d(c, k, { alpha: 0.35 });
  cards(c, k, [{ at: [-2.5, 1.5, 7], w: 2, h: 3, color: '#2b2f45' }, { at: [2.5, 1.5, 9], w: 2, h: 3, color: '#3b2f45' }, { at: [0, 1, 0], w: 1.2, h: 1.6, color: '#ff5a1f', draw: (x, w, h) => { x.fillStyle = '#fff'; x.font = `900 ${h * 0.3}px Inter`; x.textAlign = 'center'; x.fillText('3D', w / 2, h * 0.6); } }]); };
const wavePts = (y0, amp) => Array.from({ length: 40 }, (_, i) => [30 + i * 12, y0 + amp * Math.sin(i * 0.35)]);

// ---- Type ----
add('Type', 'type.js', 'word', 'Display word', 'set a display word with word()', 2, (c, t) => { dark(c); word(c, 'Hello', cx, cy, { size: 140, ...big, alpha: clamp(t * 2) }); });
add('Type', 'type.js', 'rise', 'Masked rise', 'word rises from behind its baseline (rise)', 2.5, (c, t) => { dark(c); rise(c, 'Rise', cx, cy, spr(t - 0.2), { size: 160, ...big }); });
add('Type', 'type.js', 'riseChars', 'Letter rise', 'letters rise one by one on springs (riseChars)', 2.5, (c, t) => { dark(c); riseChars(c, 'Letters', cx, cy, t, { size: 110, ...big }); });
add('Type', 'type.js', 'scramble', 'Scramble in', 'letters pop in in random order (scramble)', 2.5, (c, t) => { dark(c); scramble(c, 'SCRAMBLE', cx, cy, clamp(t / 1.2), { size: 70, ...big }); });
add('Type', 'type.js', 'typed', 'Typed on', 'type a sentence on, no caret (typed)', 3, (c, t) => { dark(c); typed(c, 'Typed on, no caret.', 40, cy, t / 2, { size: 36, color: '#fff' }); });
add('Type', 'promo.js', 'typewriter', 'Typewriter + caret', 'typewriter with a blinking caret (typewriter)', 3, (c, t) => { light(c); typewriter(c, 'Type with a caret', t, 0.2, 40, cy, { size: 40, color: '#111', align: 'left' }); });
add('Type', 'type.js', 'hitWord', 'Beat word slam', 'words slam in on the beat (hitWord)', 1.5, (c, t) => { dark(c); hitWord(c, ['ONE', 'TWO', 'THREE'][Math.floor(t / 0.5)], cx, cy, t % 0.5, { size: 140, weight: 900, ...big, blur: 12, chroma: 6 }); });
add('Type', 'type.js', 'hotWord', 'Hot keyword', 'hot keyword slides in and cools (hotWord)', 2, (c, t) => { dark(c); hotWord(c, 'HOT', cx - 120, cy, t, { size: 150 }); });
add('Type', 'type.js', 'glowIn', 'Glow in', 'word sharpens out of a blur with a bloom (glowIn)', 2, (c, t) => { dark(c); glowIn(c, 'Glow', cx, cy, t - 0.3, { size: 150, ...big }); });
add('Type', 'type.js', 'shimmer', 'Shimmer status', 'status line with a shimmer wave (shimmer)', 3, (c, t) => { dark(c); shimmer(c, 'Projecting coordinates…', 40, cy, t, { size: 32 }); });
add('Type', 'type.js', 'selectHL', 'Text selection', 'live text-selection band (selectHL)', 2, (c, t) => { light(c); selectHL(c, 'Select this word', 40, cy, 7, 11, clamp(t), { size: 50 }); });
add('Type', 'type.js', 'chromaWord', 'Chroma fringe', 'red/cyan chromatic fringes on a word (chromaWord)', 2, (c, t) => { dark(c); chromaWord(c, 'CHROMA', cx, cy, { size: 110, weight: 900, ...big, split: 3 + 4 * Math.abs(Math.sin(t * 4)) }); });
add('Type', 'type.js', 'maskWord', 'Masked word', 'word as a window onto footage (maskWord)', 3, (c, t) => { dark(c); maskWord(c, 'MASK', cx, cy + 60, f => mesh(f, ['#ff5a1f', '#7c3aed', '#06b6d4', '#facc15'], t), { size: 200, weight: 900, align: 'center' }); });
add('Type', 'type.js', 'weightWave', 'Weight wave', 'weight wave through a word (weightWave, variable font)', 3, (c, t) => { dark(c); weightWave(c, 'Weight', cx, cy, t, { size: 130, font: 'Archivo', color: '#fff', align: 'center' }); });
add('Type', 'type.js', 'fitStack', 'Justified stack', 'frame-filling justified type stack (fitStack)', 2.5, (c, t) => { dark(c); fitStack(c, ['MAKE', 'IT', 'FIT'], 40, 220, W - 80, { weight: 900 }).forEach((l, i) => rise(c, l.s, l.x, l.y, spr(t - i * 0.15), { size: l.size, weight: 900, color: '#fff' })); });
add('Type', 'type.js', 'textOnPath', 'Text on a path', 'text riding along a curve (textOnPath)', 4, (c, t) => { light(c); textOnPath(c, 'text that rides along a route  ', wavePts(cy, 80), t * 60 - 120, { size: 46 }); });
add('Type', 'type.js', 'marquee', 'Marquee row', 'endless scrolling row of type (marquee)', 4, (c, t) => { light(c); marquee(c, ['MOVE', '✓', 'FAST'], cy, t * 200, { size: 120 }); });
add('Type', 'type.js', 'inlineWord', 'Inline word', 'outlined/inline display word (inlineWord)', 2, (c, t) => { light(c); inlineWord(c, 'INLINE', cx, cy, { size: 120, align: 'center' }); });
add('Type', 'promo.js', 'headline', 'Headline build', 'headline parts blur-slide in (headline)', 3, (c, t) => { light(c); headline(c, ['Ship', ['faster.', { color: '#ff5a1f' }]], 40, cy, { t, size: 80 }); });
add('Type', 'type.js', 'flap', 'Split-flap board', 'split-flap departure-board word (flap)', 3, (c, t) => { dark(c); flap(c, 'BOARD', cx, cy, t, { cw: 90, ch: 130, size: 90 }); });
add('Type', 'lib.js', 'text', 'Poster text (Anton)', 'condensed poster text with rotate/scale (text)', 2, (c, t) => { bg(c, '#f5c518'); text(c, 'POSTER', cx, cy, { size: 150, rot: Math.sin(t * 3) * 0.05, scale: 1 + 0.05 * Math.sin(t * 6) }); });

// ---- Captions ----
add('Captions', 'type.js', 'words', 'Narration words', 'narration words arrive out of a blur (words)', 4, (c, t) => { dark(c); words(c, 'Words arrive out of a blur', cx, cy, t, { size: 40, ...big }); });
add('Captions', 'type.js', 'leadIn', 'Lead-in caption', 'creator lead-in caption, words timed (leadIn)', 4, (c, t) => { dark(c); leadIn(c, 'this is the lead in'.split(' ').map((w, i) => ({ w, t: i * 0.3 })), cx, cy, t, 3, { size: 44, ...big }); });
add('Captions', 'type.js', 'karaoke', 'Karaoke line', 'karaoke words on sung onsets (karaoke)', 3.5, (c, t) => { dark(c); karaoke(c, 'sing it back to me'.split(' ').map((w, i) => ({ w, on: i * 0.45 })), cx, cy, t, { size: 48, align: 'center' }); });
add('Captions', 'promo.js', 'pill', 'Caption pill', 'caption in a pill chip (pill)', 2, (c, t) => { light(c); c.translate(cx, cy); c.scale(spring(t), spring(t)); pill(c, 'caption pill', 0, 0, { size: 30, dot: '#22c55e' }); });
add('Captions', 'type.js', 'callout', 'Callout leader', 'callout with elbow leader and label (callout)', 2.5, (c, t) => { light(c); callout(c, 160, 560, 300, 380, 'Count ' + Math.round(clamp(t / 1.5) * 128), clamp(t / 1.2), { size: 30 }); });
add('Captions', 'type.js', 'tape', 'Washi tape', 'washi tape holding a card (tape)', 2, (c, t) => { light(c); card(c, 90, 320, 360, 320, {}); tape(c, cx, 320, 180, 50, { rot: -0.12 }); });

// ---- Camera & 3D ----
add('Camera & 3D', 'type.js', 'dollyZoom', 'Dolly zoom', 'Vertigo dolly zoom (dollyZoom + cards + floor3d)', 4, (c, t) => set3d(c, dollyZoom(pp(t, 4))));
add('Camera & 3D', 'type.js', 'orbitCam', 'Orbit camera', 'camera arcs around the subject (orbitCam)', 4, (c, t) => set3d(c, orbitCam(pp(t, 4))));
add('Camera & 3D', 'type.js', 'crane', 'Crane up', 'camera cranes up and pitches down (crane)', 4, (c, t) => set3d(c, crane(pp(t, 4))));
add('Camera & 3D', 'type.js', 'dutch', 'Dutch roll', 'horizon rolls into a dutch angle (dutch)', 4, (c, t) => set3d(c, dutch(pp(t, 4))));
add('Camera & 3D', 'type.js', 'cards', 'Defocus cards', '3D cards with lens defocus (cards focus/aperture)', 4, (c, t) => { const k = orbitCam(pp(t, 4), { r: 5 }); dark(c); cards(c, k, [0, 1, 2, 3, 4].map(i => ({ at: [(i - 2) * 0.9, 1, i * 1.5], w: 0.8, h: 1.1, color: ['#ff5a1f', '#7c3aed', '#06b6d4', '#facc15', '#22c55e'][i] })), { focus: 5, aperture: 0.08 }); });
add('Camera & 3D', 'type.js', 'focusPull', 'Rack focus', 'rack focus between near and far (focusPull)', 2.5, (c, t) => { dark(c); focusPull(c, t, n => word(n, 'NEAR', cx, cy + 200, { size: 120, ...big }), f => word(f, 'FAR', cx, cy - 150, { size: 90, color: '#888', align: 'center' }), { t0: 0.6 }); });
add('Camera & 3D', 'type.js', 'punch', 'Zoom punch', 'zoom punch on hits (punch + cam)', 1.6, (c, t) => { dark(c); cam(c, punch(t, [0.3, 0.8, 1.3], 0.12)); word(c, 'PUNCH', cx, cy, { size: 120, weight: 900, ...big }); });
add('Camera & 3D', 'type.js', 'shake', 'Camera shake', 'camera shake after a hit (shake)', 2, (c, t) => { dark(c); shake(c, t, [0.3]); word(c, 'SHAKE', cx, cy, { size: 120, weight: 900, ...big }); });
add('Camera & 3D', 'type.js', 'cam', 'Slow push-in', 'slow push-in about a point (cam)', 4, (c, t) => { dark(c); cam(c, 1 + t * 0.12); grid(c, '#0E0E10', '#262629', 40); word(c, 'PUSH', cx, cy, { size: 120, ...big }); });
add('Camera & 3D', 'type.js', 'ring3d', 'Spinning 3D ring', 'extruded 3D ring spinning (ring3d)', 3.14, (c, t) => { dark(c); ring3d(c, cx, cy, 160, 110, 30, t * 2, { face: '#fff', side: '#666' }); });
add('Camera & 3D', 'type.js', 'tunnel', 'Type tunnel', 'nested rounded-rect tunnel framing a line (tunnel)', 2, (c, t) => { dark(c); tunnel(c, cx, cy, W * 0.95, H * 0.8, 7, { from: (t / 2) % 1 }); word(c, 'DEEPER', cx, cy + 20, { size: 70, ...big }); });
add('Camera & 3D', 'type.js', 'orbit', 'Orbit rings', 'concentric orbit rings with dots (orbit)', 6.28, (c, t) => { dark(c); orbit(c, cx, cy, [{ r: 90, n: 3, dot: 7, speed: 1, lw: 1, alpha: 0.5 }, { r: 170, n: 5, dot: 5, speed: -0.6, lw: 1, alpha: 0.4 }, { r: 240, n: 8, dot: 4, speed: 0.3, lw: 1, alpha: 0.3 }], t); });
add('Camera & 3D', 'iso.js', 'ISO.slab', 'Iso slab', 'isometric rounded slab, camera turning (ISO.cam + ISO.slab)', 6, (c, t) => { light(c); const C = ISO.cam({ az: 45 + t * 30, el: 30, S: 1, ox: cx, oy: cy }); ISO.slab(c, C, ISO.rrect(-110, -110, 110, 110, 24), 0, 50 + 40 * pp(t, 3), { top: '#ffffff', side: '#e5e5e5' }); });
add('Camera & 3D', 'iso.js', 'ISO.lift', 'Plan to iso lift', 'flat plan lifts into an oblique iso view (ISO.lift)', 3, (c, t) => { light(c); const C = ISO.lift(ease.inOut(pp(t, 3)), { S: 1.4, cx, cy }); ISO.grid(c, C, -160, -160, 160, 160, 40, {}); [[-80, -80], [60, -40], [-20, 70]].forEach(([x, y], i) => ISO.slab(c, C, ISO.rrect(x - 40, y - 40, x + 40, y + 40, 8), 0, 30 + i * 25, { top: '#ffffff' })); });
add('Camera & 3D', 'iso.js', 'ISO.extrude', 'Extruded type', 'extruded type on an iso plane (ISO.extrude)', 4, (c, t) => { light(c); const C = ISO.cam({ az: 30 + 20 * Math.sin(t * 1.5), el: 35, S: 1.4, ox: cx, oy: cy }); ISO.extrude(c, C, [-100, 30, 0], [1, 0, 0], [0, 1, 0], 18, (x, px) => { x.fillStyle = '#111'; x.font = '900 80px Inter'; x.fillText('ISO', 0, 0); }, { front: '#ff5a1f' }); });

// ---- Transitions & hits ----
add('Transitions & hits', 'type.js', 'iris', 'Iris open', 'next shot opens through a growing circle (iris)', 2.5, (c, t) => { sceneA(c); iris(c, cx, cy, clamp(t - 0.6), sceneB, { ring: '#fff' }); });
add('Transitions & hits', 'type.js', 'whip', 'Whip pan', 'whip pan with motion blur (whip)', 2, (c, t) => { dark(c); whip(c, (x, ox) => ['#0E0E10', '#ff5a1f'].forEach((col, i) => { x.fillStyle = col; x.fillRect(ox + i * W, 0, W, H); word(x, i ? 'B' : 'A', ox + i * W + cx, cy + 60, { size: 200, ...big }); }), 0, W, clamp(t - 0.5)); });
add('Transitions & hits', 'type.js', 'flash', 'Exposure flash', 'exposure flash on a cut (flash)', 1.5, (c, t) => { (t < 0.5 ? sceneA : sceneB)(c); flash(c, t, 0.5); });
add('Transitions & hits', 'type.js', 'glitchBox', 'Glitch box', 'glitch blocks for a few frames (glitchBox)', 1.2, (c, t) => { sceneA(c); glitchBox(c, 0, 0, W, H, t - 0.4, { frames: 8 }); });
add('Transitions & hits', 'type.js', 'softcut', 'Soft cut', '1–2 frame soft crossfade cut (softcut)', 1.5, (c, t) => { softcut(c, t, 0.75, sceneA, sceneB, { frames: 6 }); });
add('Transitions & hits', 'type.js', 'slitReveal', 'Slit reveal', 'next shot opens through a lit slit (slitReveal)', 2, (c, t) => { sceneA(c); slitReveal(c, clamp(t - 0.4), sceneB); });
add('Transitions & hits', 'type.js', 'morphMatch', 'Shape-match morph', 'one box morphs into another (morphMatch)', 3, (c, t) => { dark(c); morphMatch(c, { x: 200, y: 410, w: 140, h: 140, r: 70 }, { x: 60, y: 300, w: 420, h: 360, r: 24 }, pp(t, 3), { fill: '#ff5a1f' }); });
add('Transitions & hits', 'type.js', 'shutterButton', 'Shutter to button', 'bars close into a CTA button (shutterButton)', 2.5, (c, t) => { light(c); shutterButton(c, { x: 60, y: 300, w: 420, h: 360 }, { x: 150, y: 450, w: 240, h: 70, label: 'Get started' }, clamp(t / 1.8)); });
add('Transitions & hits', 'promo.js', 'wipe', 'Colour wipe', 'full-frame colour wipe (wipe)', 2, (c, t) => { sceneA(c); wipe(c, clamp(t - 0.4), '#ff5a1f'); });
add('Transitions & hits', 'type.js', 'starburst', 'Starburst', 'light rays burst from a point (starburst)', 1.8, (c, t) => { dark(c); starburst(c, cx, cy, 320, { p: clamp(t / 1.7), n: 24 }); });
add('Transitions & hits', 'type.js', 'smear', 'Smear frame', 'smear frames / motion-blur copies (smear)', 1.5, (c, t) => { dark(c); const dx = 120 * Math.sin(t * 4.2); smear(c, x => word(x, 'SMEAR', cx + dx, cy, { size: 110, ...big }), 60 * Math.cos(t * 4.2), 0, { n: 8 }); });
add('Transitions & hits', 'look.js', 'impactFrame', 'Impact frame', 'inverted impact frame on a hit (impactFrame)', 1, (c, t) => { scene(c, t); if (t < 0.12) impactFrame(c, 1); });
add('Transitions & hits', 'look.js', 'zoomBlur', 'Zoom blur', 'radial zoom blur on a punch (zoomBlur)', 1, (c, t) => { scene(c, t); zoomBlur(c, Math.exp(-t * 5)); });
add('Transitions & hits', 'look.js', 'lightSweep', 'Light sweep', 'soft light band sweeps across (lightSweep)', 2, (c, t) => { scene(c, t); lightSweep(c, clamp(t / 1.5)); });
add('Transitions & hits', 'look.js', 'filmBurn', 'Film burn', 'film burn from a corner (filmBurn)', 1.6, (c, t) => { scene(c, t); filmBurn(c, clamp(t)); });
add('Transitions & hits', 'look.js', 'blueTear', 'Blue tear', 'frame shreds into blue bands (blueTear)', 1, (c, t) => { scene(c, t); if (t > 0.5 && t < 0.65) blueTear(c, t); });
add('Transitions & hits', 'look.js', 'vhsTear', 'VHS tear', 'VHS tracking tear (vhsTear)', 1, (c, t) => { scene(c, t); if (t > 0.5 && t < 0.65) vhsTear(c, t); });
add('Transitions & hits', 'look.js', 'crtCollapse', 'CRT power-off', 'CRT collapses to a line (crtCollapse)', 2, (c, t) => { scene(c, t); crtCollapse(c, pp(t, 2)); });
add('Transitions & hits', 'look.js', 'defocusExit', 'Defocus exit', 'frame defocuses away (defocusExit)', 2, (c, t) => { scene(c, t); defocusExit(c, clamp(t - 0.5)); });
add('Transitions & hits', 'look.js', 'stutterRepeat', 'Stutter echo', 'frame echoed across x on a hit (stutterRepeat)', 1, (c, t) => { scene(c, t); stutterRepeat(c, Math.exp(-t * 4)); });
add('Transitions & hits', 'look.js', 'mosh', 'Datamosh', 'datamosh blocks breaking up (mosh)', 2, (c, t) => { scene(c, t); mosh(c, t, pp(t, 2)); });

// ---- Particles & shapes ----
const SPH = pointCloud('sphere', 600), TOR = pointCloud('torus', 600), FLD = pointCloud('field', 500), HLX = pointCloud('helix', 500);
add('Particles & shapes', 'type.js', 'drawCloud', 'Particle sphere', 'turning particle sphere (pointCloud + drawCloud)', 6, (c, t) => { dark(c); drawCloud(c, i => SPH[i], t, { n: 600, ry: t, rx: 0.3 }); });
add('Particles & shapes', 'type.js', 'drawCloud', 'Bokeh torus', 'particle torus with focus bokeh (drawCloud focus)', 6, (c, t) => { dark(c); drawCloud(c, i => TOR[i], t, { n: 600, ry: t * 0.8, rx: 0.9, focus: 0, color: '#ffb36b', op: 'lighter' }); });
add('Particles & shapes', 'type.js', 'drawCloud', 'Particle rain', 'falling particle field with streaks (drawCloud trail)', 3, (c, t) => { dark(c); drawCloud(c, (i, u) => { const p = FLD[i]; return [p[0], ((p[1] + u * 0.7 + 1) % 2 + 2) % 2 - 1, p[2]]; }, t, { n: 500, trail: 0.06, ry: 0.4 }); });
add('Particles & shapes', 'type.js', 'drawCloud', 'Helix', 'double helix of particles (pointCloud helix)', 6, (c, t) => { dark(c); drawCloud(c, i => HLX[i], t, { n: 500, ry: t, color: '#7dd3fc' }); });
add('Particles & shapes', 'type.js', 'textPts', 'Word from particles', 'word assembles from particles (textPts + mixPts)', 4, (c, t) => { dark(c); const A = textPts('CLAUDE', 700, { weight: 900 }); drawCloud(c, i => mixPts(SPH, A, i, clamp(pp(t, 4) * 1.4 - 0.2), { burst: 0.4 }), t, { n: 600, scale: 110 }); });
add('Particles & shapes', 'type.js', 'morphPts', 'Shape morph', 'outline morphs circle → star (shapePts + morphPts)', 3, (c, t) => { dark(c); drawPts(c, morphPts(shapePts('circle', 200), shapePts('star', 200, { k: 5 }), spr(t - 0.3) - spr(t - 1.8)), cx, cy, 170, { fill: '#ff5a1f' }); });
add('Particles & shapes', 'type.js', 'onion', 'Onion skin', 'onion-skin ghosts behind a moving shape (onion)', 2, (c, t) => { dark(c); onion(c, (x, u) => drawPts(x, shapePts('flower', 120, { k: 6 }), cx + 160 * Math.sin(u * 3.14), cy, 60, { fill: '#fff', rot: u * 2 }), t, { n: 6 }); });
add('Particles & shapes', 'type.js', 'squashDot', 'Squash & stretch dot', 'bouncing dot with squash and stretch (squashDot)', 1, (c, t) => { dark(c); const y = u => H * 0.75 - 500 * Math.abs(Math.sin(u * Math.PI)); squashDot(c, cx, y(t), 40, 0, (y(t) - y(t - 1 / 60)) * 60, { color: '#ff5a1f' }); });
add('Particles & shapes', 'type.js', 'pixelField', 'Pixel field', 'square-dot field rippling (pixelField)', 3, (c, t) => { dark(c); pixelField(c, (i, j, u) => Math.round(2 + 2 * Math.sin(i * 0.4 + j * 0.3 - u * 4)), t); });
add('Particles & shapes', 'type.js', 'tumbleTiles', 'Tumbling tiles', 'tiles tumble into a row (tumbleTiles)', 3, (c, t) => { dark(c); tumbleTiles(c, 6, cx, cy, pp(t, 3), t); });
add('Particles & shapes', 'type.js', 'chain', 'Chain links', 'chain of links popping in (chain)', 3, (c, t) => { dark(c); chain(c, 60, cy, (t * 2.5) % 7, { L: 80, lw: 10 }); });
add('Particles & shapes', 'type.js', 'sparkHop', 'Spark hop', 'a spark hops between points (sparkHop)', 3, (c, t) => { dark(c); sparkHop(c, [[100, 300], [420, 420], [150, 620], [420, 800]], t); });

// ---- HUD & data ----
const SER = series(60);
add('HUD & data', 'type.js', 'glyphHud', 'Glyph HUD', 'hatched mono cells resolve into a word (glyphHud)', 3, (c, t) => { dark(c); glyphHud(c, 'HUD', 80, cy, t, { size: 120 }); });
add('HUD & data', 'type.js', 'counterRoll', 'Rolling counter', 'rolling odometer counter (counterRoll)', 5, (c, t) => { dark(c); counterRoll(c, t * 3, cx, cy, { size: 100, color: '#fff' }); });
add('HUD & data', 'promo.js', 'counter', 'Count-up number', 'big number counting up (counter)', 3, (c, t) => { dark(c); counter(c, ease.out(clamp(t / 2)) * 24800, cx, cy, { size: 100, prefix: '$' }); });
add('HUD & data', 'type.js', 'expCount', 'Exponential counter', 'live counter on a log scale (expCount)', 4, (c, t) => { dark(c); word(c, expCount(t / 4, 1000, 8e9), cx, cy, { size: 46, ...big }); });
add('HUD & data', 'type.js', 'slotList', 'Slot feature roll', 'feature list rolls like a slot (slotList + slotStep)', 3, (c, t) => { dark(c); slotList(c, ['Fast', 'Typed', 'Secure', 'Open', 'Local'], cx, cy, slotStep(t, 0.6), { size: 60, lh: 80, color: '#fff' }); });
add('HUD & data', 'type.js', 'ecg', 'Heart monitor', 'ECG trace sweeping (ecg)', 3, (c, t) => { dark(c); ecg(c, 40, cy, W - 80, 200, t, { color: '#4ade80' }); });
add('HUD & data', 'type.js', 'waveBars', 'Voice bars', 'voice waveform bars (waveBars)', 3, (c, t) => { dark(c); waveBars(c, 40, cy, W - 80, 220, t, { level: 0.3 + 0.7 * Math.abs(Math.sin(t * 3)) }); });
add('HUD & data', 'type.js', 'barcode', 'Barcode draw', 'barcode draws in (barcode)', 2.5, (c, t) => { light(c); barcode(c, 70, 360, 400, 220, { p: clamp(t / 1.2) }); });
add('HUD & data', 'promo.js', 'lineChart', 'Line chart', 'growth line chart draws itself (lineChart + series)', 3, (c, t) => { dark(c); lineChart(c, SER, 40, 300, W - 80, 360, clamp(t / 2)); });
add('HUD & data', 'type.js', 'trackers', 'Tracker reticles', 'tracker reticles with coordinates (trackers)', 3, (c, t) => { dark(c); trackers(c, [[160 + 40 * Math.sin(t * 2), 320], [380, 640 + 40 * Math.cos(t * 2)]], 1); });
add('HUD & data', 'type.js', 'cornerTicks', 'Corner ticks', 'corner ticks frame small type (cornerTicks)', 2, (c, t) => { dark(c); cornerTicks(c, 90, 360, 360, 240, { p: clamp(t) }); ui(c, 'SMALL TYPE, BIG SPACE', cx, cy, { color: '#fff', align: 'center' }); });
add('HUD & data', 'type.js', 'rainbowBars', 'CRT colour bars', 'colour bars with scanlines (rainbowBars)', 2, (c, t) => { dark(c); rainbowBars(c, 0, 0, W, H, { p: clamp(t) }); });
add('HUD & data', 'type.js', 'pins', 'Annotation pins', 'numbered pins pop in (pins)', 3, (c, t) => { dark(c); pins(c, [[120, 300], [380, 440], [200, 660]], t * 2); });
add('HUD & data', 'promo.js', 'hudFrame', 'HUD frame', 'camera HUD chrome with timecode (hudFrame)', 4, (c, t) => { dark(c); hudFrame(c, t, { color: '#fff', tl: 'CLAUDE-S', tr: 'REC ●' }); });
add('HUD & data', 'type.js', 'player', 'Video player', 'clip in a player frame with playhead (player)', 4, (c, t) => { dark(c); player(c, 40, 340, W - 80, 260, (x, a, b, w, h) => { x.fillStyle = '#2b2f45'; x.fillRect(a, b, w, h); }, { time: t / 4, label: 'clip.mp4' }); });
add('HUD & data', 'type.js', 'glass', 'Glass panel', 'dark glass panel under a key light (glass + keylight)', 4, (c, t) => { dark(c); keylight(c, '#ffffff', t); glass(c, 60, 360, 420, 240); ui(c, 'Glass UI', 100, 420, { color: '#fff' }); });
add('HUD & data', 'type.js', 'skeletonFlash', 'Skeleton load', 'skeleton boxes flash then fill (skeletonFlash)', 2.5, (c, t) => { dark(c); skeletonFlash(c, [{ x: 60, y: 260, w: 420, h: 120 }, { x: 60, y: 400, w: 200, h: 200 }, { x: 280, y: 400, w: 200, h: 200 }], clamp(t / 1.5)); });
const CUR = cursorPath([{ t: 0, x: 100, y: 820 }, { t: 0.8, x: 270, y: 500, click: true }, { t: 2, x: 430, y: 300 }]);
add('HUD & data', 'promo.js', 'cursorPath', 'Cursor walk + click', 'choreographed cursor with click ring (cursorPath + drawCursor + clickRing)', 3, (c, t) => { light(c); card(c, 120, 450, 300, 100, { fill: '#111' }); CUR.clicks.forEach(k => clickRing(c, 270, 500, t - k, { color: '#ff5a1f' })); drawCursor(c, CUR(t)); });
add('HUD & data', 'type.js', 'clickDisc', 'Click disc', 'grey click disc under a pointer (clickDisc + pointer)', 1, (c, t) => { light(c); clickDisc(c, 300, 500, t); pointer(c, 300, 500, 1); });
add('HUD & data', 'promo.js', 'connector', 'Connector pulse', 'curved connector with a travelling pulse (connector)', 2, (c, t) => { dark(c); connector(c, [80, 320], [460, 680], 1, { q: (t / 2) % 1, alpha: 0.6 }); pill(c, 'source', 80, 320, { size: 22 }); pill(c, 'target', 460, 680, { size: 22 }); });
add('HUD & data', 'type.js', 'guides', 'Construction guides', 'construction guides around a box (guides)', 2, (c, t) => { light(c); guides(c, [{ x: 120, y: 380, w: 300, h: 200 }], clamp(t)); });

// ---- Paper & line ----
add('Paper & line', 'lib.js', 'sketch', 'Hand-drawn box', 'boiling hand-drawn sketch line (sketch + boil)', 2.5, (c, t) => { bg(c, '#f4efe6'); sketch(c, [[80, 300], [460, 300], [460, 660], [80, 660]], { closed: true, p: clamp(t / 1.5), seed: 1 + boil(t, 12, 3), fill: '#f5c518' }); });
add('Paper & line', 'lib.js', 'paper', 'Paper texture', 'papery texture over the frame (paper)', 2, (c, t) => { bg(c, '#efe6d4'); text(c, 'paper', cx, cy, { size: 120, font: 'Instrument Serif', color: '#383933' }); paper(c, 0.7); });
add('Paper & line', 'type.js', 'drawOn', 'Phosphor draw-on', 'glowing line draws itself (drawOn)', 2.5, (c, t) => { dark(c); drawOn(c, [[60, 700], [200, 400], [340, 600], [480, 250]], clamp(t / 1.5)); });
add('Paper & line', 'type.js', 'pen', 'Comet pen', 'tapered comet hairline along a path (pen)', 3, (c, t) => { light(c); const P = wavePts(cy, 120); pen(c, P, (t / 2.5) * polyLen(P) * 1.2); });
add('Paper & line', 'type.js', 'arrow', 'Editorial arrow', 'thick arrow draws itself (arrow)', 2, (c, t) => { light(c); arrow(c, 100, cy, 320, clamp(t)); });
add('Paper & line', 'type.js', 'check', 'Check mark', 'circled check draws itself (check)', 2, (c, t) => { light(c); check(c, cx, cy, 100, { p: clamp(t) }); });
add('Paper & line', 'type.js', 'hl', 'Highlighter', 'highlighter block wipes behind a word (hl)', 2, (c, t) => { light(c); hl(c, 50, cy - 70, 440, 90, clamp(t * 1.5), '#f5c518'); word(c, 'highlight', cx, cy, { size: 90, color: '#111', align: 'center' }); });
add('Paper & line', 'type.js', 'grid', 'Grid paper', 'grid-paper ground (grid)', 2, (c, t) => { grid(c, '#F4F3EF', '#dddad2', 40, (t * 20) % 40); word(c, 'grid', cx, cy, { size: 100, color: '#111', align: 'center' }); });

// ---- Looks ----
for (const p of ['film16', 'archival', 'crt', 'lcd', 'vhs', 'aura']) add('Looks', 'look.js', 'applyLook', 'Look: ' + p, `whole-frame ${p} look (applyLook LOOK.${p})`, 3, (c, t) => { scene(c, t); applyLook(c, t, null, p); });
add('Looks', 'look.js', 'grade', 'Print grade', 'print-film grade (grade)', 3, (c, t) => { scene(c, t); grade(c, 1); });
add('Looks', 'look.js', 'vignette', 'Vignette', 'vignette (vignette)', 3, (c, t) => { scene(c, t); vignette(c, 0.8); });
add('Looks', 'look.js', 'filmGrain', 'Film grain', 'film grain (filmGrain)', 3, (c, t) => { scene(c, t); filmGrain(c, t, 0.2); });
add('Looks', 'look.js', 'rgbSplit', 'RGB split', 'chromatic RGB split (rgbSplit)', 3, (c, t) => { scene(c, t); rgbSplit(c, 1.5); });
add('Looks', 'look.js', 'halftone', 'Halftone', 'halftone dot screen (halftone)', 3, (c, t) => { scene(c, t); halftone(c, 1); });
add('Looks', 'look.js', 'tealOrange', 'Teal & orange', 'teal and orange split-tone (tealOrange)', 3, (c, t) => { scene(c, t); tealOrange(c, 0.7); });
add('Looks', 'look.js', 'fisheye', 'Fisheye', 'fisheye lens bulge (fisheye)', 3, (c, t) => { scene(c, t); fisheye(c, 0.4); });
add('Looks', 'look.js', 'lensFlare', 'Lens flare', 'anamorphic lens flare (lensFlare)', 3, (c, t) => { scene(c, t); lensFlare(c, cx + 150 * Math.sin(t * 2), H * 0.3, 1); });
add('Looks', 'look.js', 'doubleExposure', 'Double exposure', 'second picture through the brights (doubleExposure)', 3, (c, t) => { scene(c, t); doubleExposure(c, (x, w, h) => { mesh(x, ['#22d3ee', '#7c3aed', '#facc15'], t); }); });
add('Looks', 'look.js', 'lutStab', 'Thermal LUT stab', 'thermal LUT stab on a hit (lutStab)', 3, (c, t) => { scene(c, t); lutStab(c, 'thermal'); });
add('Looks', 'look.js', 'asciiRender', 'ASCII render', 'the frame as ASCII glyphs (asciiRender)', 3, (c, t) => { scene(c, t); asciiRender(c, 1); });
add('Looks', 'type.js', 'keylight', 'Key light + dust', 'soft key light with drifting dust (keylight + dust)', 6, (c, t) => { dark(c); keylight(c, '#ffd9a8', t); dust(c, t); });
add('Looks', 'type.js', 'litGround', 'Lit ground', 'flat colour lit like a surface (litGround)', 3, (c, t) => { litGround(c, '#2b2f45'); word(c, 'lit', cx, cy, { size: 140, ...big }); });
add('Looks', 'promo.js', 'mesh', 'Mesh gradient', 'animated mesh-gradient ground (mesh)', 6, (c, t) => { mesh(c, ['#ff5a1f', '#7c3aed', '#06b6d4', '#facc15'], t); });
add('Looks', 'promo.js', 'ground', 'Promo ground', 'promo ground with lattice and blooms (ground)', 4, (c, t) => { ground(c, t, { lattice: 'dots', oy: t * 20 }); });
add('Looks', 'promo.js', 'glow', 'Soft glow', 'soft radial glow / light leak (glow)', 3, (c, t) => { dark(c); glow(c, cx + 100 * Math.sin(t * 2), cy, 300, '#ff5a1f', 0.7); });

// ---- aesthetic reel kit (2026-10-18) ----
const cream = c => bg(c, '#F6F2EA');
const warm = c => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#C9A285'); g.addColorStop(1, '#4E3B2E'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#E8D3BF'; c.beginPath(); c.ellipse(cx, H * 0.62, 120, 170, 0, 0, 7); c.fill(); c.beginPath(); c.arc(cx, H * 0.36, 70, 0, 7); c.fill(); }; // a stand-in talking head
add('Aesthetic', 'type.js', 'clipSheet', 'Binder-clip grid sheet', 'gridded paper sheet held by a binder clip, dropping in (clipSheet)', 3, (c, t) => { cream(c); clipSheet(c, cx, cy, W * 0.74, H * 0.7, { p: prog(t, 0, 0.6) }); });
add('Aesthetic', 'type.js', 'clipSheet', 'Paper clip + washi sheets', 'ruled sheet with a paper clip, plain sheet with washi tape (clipSheet holder)', 3, (c, t) => { bg(c, '#EDE6F2');
  clipSheet(c, cx - 40, H * 0.3, W * 0.6, H * 0.36, { kind: 'ruled', holder: 'paperclip', rot: 0.04, p: prog(t, 0, 0.6) });
  clipSheet(c, cx + 40, H * 0.72, W * 0.6, H * 0.34, { kind: 'plain', holder: 'tape', clip: '#F2B8C6', rot: -0.05, p: prog(t, 0.3, 0.9) }); });
add('Aesthetic', 'type.js', 'serifStack + scriptLine', 'Serif stack + script accent', 'giant condensed serif headline with a handwritten script line under it (serifStack + scriptLine)', 4, (c, t) => { cream(c);
  const y = serifStack(c, ['I tried', 'every planner', 'for a year'], cx, H * 0.3, W * 0.8, t); scriptLine(c, "so here's the keeper", cx, y + 80 * S, prog(t, 0.9, 1.8)); });
add('Captions', 'type.js', 'mixWords', 'Mixed-voice caption', 'caption words in mixed fonts (small serif, heavy word, script) popping in on their onsets (mixWords)', 3, (c, t) => { warm(c);
  mixWords(c, [{ s: 'Quiet', font: 'Instrument Serif', weight: 400, size: 56 * S, at: 0.1 }, { s: 'PANTRY', font: 'Anton', weight: 400, size: 110 * S, color: '#F7EFA0', br: true, at: 0.35 }, { s: 'upgrade', font: 'Caveat', weight: 600, size: 80 * S, br: true, dy: -0.2, at: 0.6 }], cx, H * 0.14, t);
  mixWords(c, [{ s: '53', font: 'Gloock', size: 120 * S, at: 1.2, color: '#F7EFA0' }, { s: 'grams of', size: 44 * S, at: 1.35, dy: -0.6 }], cx, H * 0.88, t); });
add('Captions', 'type.js', 'scriptLine', 'Script word caption', 'one handwritten script word written on over the picture (scriptLine)', 2.5, (c, t) => { warm(c);
  scriptLine(c, 'honestly?', cx, H * 0.2, prog(t, 0.1, 0.8), { size: 110 * S, color: '#FFFFFF' }); });
add('Captions', 'type.js', 'serifSub', 'Serif subtitles + staggered title', 'elegant serif subtitles fading in word by word, staggered two-line title (serifSub)', 4, (c, t) => { warm(c);
  serifSub(c, "if you're someone\nwho keeps a list of", W * 0.08, H * 0.16, t, { size: 64 * S, align: 'left', indent: 70 * S, rate: 5 });
  serifSub(c, 'the truth is, it started by accident', cx, H * 0.9, t - 1.4, { font: 'Instrument Serif', weight: 'italic 400', size: 50 * S }); });
add('Captions', 'type.js', 'handleChip', 'Ranked handle chip', 'ranking: big script numeral + dark creator chip with avatar, handle and subtitle (handleChip)', 3, (c, t) => { warm(c);
  handleChip(c, W * 0.3, H * 0.14, 'slowmorning.studio', 'Slow Morning Studio', t - 0.1, { num: 1 }); handleChip(c, W * 0.3, H * 0.3, 'paperandpine', 'Paper & Pine · Ceramics', t - 1.2, { num: 2, avatar: '#C2452D' }); });
add('Paper & line', 'type.js', 'loopArrow', 'Looping drawn arrow', 'hand-drawn arrow with a loop, drawing on (loopArrow)', 3, (c, t) => { cream(c);
  loopArrow(c, W * 0.15, H * 0.4, W * 0.85, H * 0.5, prog(t, 0.1, 1.2)); loopArrow(c, W * 0.8, H * 0.65, W * 0.25, H * 0.8, prog(t, 0.6, 1.7), { color: '#6F8A3A', loop: 0.2 }); });
add('Paper & line', 'type.js', 'scribble', 'Drawn underline / circle / zigzag / spark', 'hand-drawn underline, circle, zigzag and spark marks drawing on (scribble)', 3, (c, t) => { cream(c);
  const lab = (s, y) => word(c, s, cx, y, { size: 64 * S, font: 'Gloock', weight: 400, color: '#1E1C19', align: 'center' });
  lab('underline', H * 0.17); scribble(c, 'underline', cx - 130, H * 0.18, 260, 26, prog(t, 0, 0.6));
  lab('circled', H * 0.4); scribble(c, 'circle', cx - 130, H * 0.4 - 55, 260, 85, prog(t, 0.3, 1.0), { color: '#2F6FD6' });
  lab('scribbled', H * 0.63); scribble(c, 'zigzag', cx - 120, H * 0.63 - 22, 240, 26, prog(t, 0.6, 1.2), { color: 'rgba(245,214,60,0.7)' });
  lab('wow', H * 0.86); scribble(c, 'spark', cx + 40, H * 0.86 - 110, 90, 70, prog(t, 0.9, 1.5), { color: '#1E1C19' }); });
add('Aesthetic', 'type.js', 'cutout', 'Cut-out prop stickers', 'die-cut prop stickers (cup, camera, laptop, photo) popping in with a tilt (cutout)', 4, (c, t) => { cream(c);
  cutout(c, W * 0.3, H * 0.25, 140, 190, t - 0.1, { kind: 'cup', rot: -0.1 }); cutout(c, W * 0.7, H * 0.3, 180, 170, t - 0.4, { kind: 'camera' });
  cutout(c, W * 0.32, H * 0.65, 230, 180, t - 0.7, { kind: 'laptop', rot: 0.05 }); cutout(c, W * 0.72, H * 0.72, 170, 200, t - 1.0, { kind: 'photo', rot: 0.1 }); });
add('Aesthetic', 'type.js', 'tornLabel', 'Torn paper labels on a cutting mat', 'torn paper strips with handwritten caps, set down on a green cutting mat (tornLabel)', 4, (c, t) => { grid(c, '#1F6B4A', 'rgba(255,255,255,0.22)', 36);
  tornLabel(c, 'before the move', cx - 30, H * 0.3, t - 0.1); tornLabel(c, 'the journey', cx + 60, H * 0.45, t - 0.6, { rot: 0.06, seed: 9 }); tornLabel(c, 'life after', cx - 10, H * 0.62, t - 1.1, { rot: -0.02, seed: 4 }); });
add('Aesthetic', 'type.js', 'starConfetti + stripeMat', 'Before / after on star confetti', 'cream star-confetti ground with a before/after two-up, the after in a pinstripe mat (starConfetti + stripeMat)', 4, (c, t) => { cream(c); starConfetti(c, t);
  word(c, 'What a good edit changes', cx, H * 0.24, { size: 40 * S, weight: 700, color: '#2B2620', align: 'center' });
  const bw = W * 0.38, bh = H * 0.36, y = H * 0.29; [[W * 0.07, '#6B6560'], [W * 0.55, '#C9A285']].forEach(([x, col], i) => { c.fillStyle = col; c.fillRect(x, y, bw, bh); word(c, i ? 'After' : 'Before', x + bw / 2, y + bh + 50 * S, { size: 40 * S, weight: 700, color: '#2B2620', align: 'center' }); });
  stripeMat(c, W * 0.55, y, bw, bh); mixWords(c, [{ s: 'Secret', font: 'Instrument Serif', weight: 400, size: 30 * S, at: 0.4 }, { s: 'TRICK', font: 'Anton', weight: 400, size: 64 * S, br: true, color: '#F7EFA0', at: 0.6 }], W * 0.55 + bw / 2, y + 60 * S, t); });
add('Aesthetic', 'type.js', 'clipSheet + serifStack + scriptLine + cutout + loopArrow', 'Aesthetic cover (composite)', 'aesthetic reel cover: clipped grid sheet, giant condensed serif headline, script accent, cut-out props, looping arrow', 6, (c, t) => {
  bg(c, '#F7F4EF'); clipSheet(c, cx - 10, cy - 10, W * 0.66, H * 0.8, { p: prog(t, 0, 0.5), rot: -0.025 });
  const y = serifStack(c, ['I shot 6', 'film', 'cameras for', 'a month'], cx - 10, H * 0.2, W * 0.6, t - 0.4);
  scriptLine(c, "here's the keeper", cx - 4, y + 110 * S, prog(t, 1.2, 2.0), { size: 84 * S });
  cutout(c, W * 0.8, H * 0.13, 330 * S, 260 * S, t - 1.8, { kind: 'laptop', rot: 0.08 });
  cutout(c, W * 0.1, H * 0.5, 210 * S, 290 * S, t - 2.0, { kind: 'cup', rot: -0.12 });
  cutout(c, W * 0.86, H * 0.64, 250 * S, 240 * S, t - 2.2, { kind: 'camera', rot: 0.06 });
  loopArrow(c, W * 0.55, H * 0.9, W * 0.9, H * 0.93, prog(t, 2.5, 3.3), { loop: 0.13 }); });

// ---- Fast cuts and transitions (2026-10-18: three creator/vlog reels) ----
const lab = (c, s) => word(c, s, 24, 50, { size: 22, weight: 600, color: '#fff', track: 0.08 }); // which shot is on screen
const shotA = c => { sceneA(c); c.fillStyle = '#3a3d4a'; c.beginPath(); c.arc(cx, cy - 170, 70, 0, 7); c.fill(); lab(c, 'A'); };
const shotB = c => { sceneB(c); lab(c, 'B'); };
const person = c => { c.moveTo(cx + 80, cy - 170); c.arc(cx, cy - 170, 80, 0, 7); c.moveTo(cx - 190, H); c.ellipse(cx, H, 190, 380, 0, Math.PI, 0); };
add('Transitions & hits', 'type.js', 'matteCut', 'Matte cut', 'the subject silhouette flashes solid white across the cut (matteCut)', 2, (c, t) => { matteCut(c, t, 1, shotA, shotB, { mask: person, pre: 4, post: 4 }); });
add('Transitions & hits', 'type.js', 'windowCut', 'Window cut', 'next shot hops in as a frame-in-frame on black, then fills (windowCut)', 2.5, (c, t) => { windowCut(c, t, 0.8, shotA, shotB, { hold: 5 }); });
add('Transitions & hits', 'type.js', 'rollCut', 'Roll cut', 'spin transition: the frame rolls 180° through the cut with blur (rollCut)', 2, (c, t) => { rollCut(c, t, 1, shotA, shotB, { dur: 0.5 }); });
add('Transitions & hits', 'type.js', 'zoomThrough', 'Zoom-through', 'punch into A, land on B zoomed in and settle out (zoomThrough)', 2, (c, t) => { zoomThrough(c, t, 1, shotA, shotB, { pre: 0.2, out: 0.6 }); });
add('Transitions & hits', 'type.js', 'panes', 'Split panes', 'split screen whose panes pop in one per beat, labelled (panes)', 2.5, (c, t) => { panes(c, t, 0.3, [shotA, shotB], { labels: ['SHOT A', 'SHOT B'] }); });
add('Transitions & hits', 'look.js', 'letterbox', 'Letterbox', 'bars close to 2.39 scope, then shut the shot to black (letterbox)', 3, (c, t) => { scene(c, t); letterbox(c, pp(t, 3) * 1.6, 0.8); });
add('Transitions & hits', 'look.js', 'lutStab xray', 'X-ray hit', '2-frame negative flash on a cut (lutStab xray)', 1.5, (c, t) => { (t < 0.5 ? shotA : scene)(c, t); if (t >= 0.5 && t < 0.5 + 3 / 30) lutStab(c, 'xray'); });
// T147–T150: the cinematic grades (2026-10-18), graded scene with a before | after wipe
for (const p of ['umber', 'alpine', 'cream', 'golden']) add('Looks', 'look.js', 'applyLook', 'Grade: ' + p, `cinematic ${p} grade, before | after wipe (applyLook LOOK.${p}; grade.sh for footage)`, 3, (c, t) => {
  const x = W * (0.15 + 0.7 * pp(t, 3)); scene(c, t); applyLook(c, t, null, p);
  c.save(); c.beginPath(); c.rect(0, 0, x, H); c.clip(); scene(c, t); c.restore(); c.fillStyle = '#fff'; c.fillRect(x - 1, 0, 2, H);
});
// T151–T152: real-photo stickers (CC0, subject lifted by ugc-edit's stickers.py with macOS Vision; credits in assets/stickers/CREDITS.md).
// ponytail: the gallery has no IMGS loader, so these two preload here; a card draws its sticker once the PNG has landed.
const STK = Object.fromEntries(['iced-coffee', 'laptop'].map(n => { const i = new Image(); i.src = 'assets/stickers/' + n + '.png'; return [n, i]; }));
const stk = (c, n, x, y, w, t, o = {}) => { const im = STK[n]; if (im.complete && im.naturalWidth) cutout(c, x, y, w, (w * im.naturalHeight) / im.naturalWidth, t, { img: im, ...o }); };
add('Aesthetic', 'type.js', 'cutout img + stickers.py', 'Real-photo cut-out stickers', 'real photo stickers: stickers.py finds a CC0 photo, Vision lifts the subject, cutout() gives it a die-cut border that follows the alpha (cutout img)', 4, (c, t) => { cream(c);
  stk(c, 'iced-coffee', W * 0.36, H * 0.3, 300, t - 0.1, { rot: -0.08 }); stk(c, 'laptop', W * 0.6, H * 0.66, 340, t - 0.5, { rot: 0.06 }); });
add('Aesthetic', 'type.js', 'cutout img + mixWords', 'Photo sticker beside a caption', 'a lifted photo sticker springs in on its word next to a mixed-type caption (ugc-edit reel stk with a stickers/ PNG)', 4, (c, t) => { scene(c, t);
  mixWords(c, [{ s: 'my', at: 0 }, { s: 'morning', at: 0.15, font: 'Instrument Serif', weight: 'italic 400' }, { s: 'fuel', at: 0.35, br: true, font: 'Caveat', color: '#F6B9D2', size: 80 }], cx, H * 0.14, t, { size: 64 });
  stk(c, 'iced-coffee', W * 0.7, H * 0.56, 220, t - 0.45, { rot: 0.1 }); });
