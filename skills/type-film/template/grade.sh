#!/bin/sh
# Cinematic grade presets for real footage: LOOK.umber alpine cream golden from look.js (measured on four reels, see
# references.md "2026-10-18 cinematic grades"). The curves, per-band saturation, halation, vignette and grain are read from
# look.js itself, so the canvas and ffmpeg versions never drift. Audio is copied untouched.
# usage: sh grade.sh in.mp4 out.mp4 PRESET [K=1] [BARS=0]     BARS=2.39 adds scope bars; K 0 = untouched, 1 = the full look
#   umber   moody low-key amber, crushed blacks, heavy vignette (night, interiors, food, objects)
#   alpine  cool, desaturated highs, teal shadows (landscape, travel, daylight exteriors)
#   cream   faded: lifted warm blacks, soft highs, muted (interviews, lifestyle, cream/terracotta + misty blue)
#   golden  warm golden hour, olive shadows, warm glow (outdoor portraits, late sun)
# ~25 fps at 1440x1080 on an M4 Pro (geq does the per-band saturation). Keep format=gbrp: with rgb24 the halation blend came out magenta.
# Saturation uses limited-range luma, so it lands within a few % of the canvas pass; curves are splines here, linear in look.js.
set -e
IN="$1"; OUT="$2"; P="$3"; K="${4:-1}"; BARS="${5:-0}"
[ -f "$IN" ] && [ -n "$OUT" ] && [ -n "$P" ] || { echo "usage: sh grade.sh in.mp4 out.mp4 umber|alpine|cream|golden [K=1] [BARS=0]"; exit 1; }
VF=$(node -e '
global.window = global; global.document = {}; require(process.argv[1]);
const [, , P, K, BARS] = process.argv, k = +K, L = LOOK[P];
if (!L || !L.curves) { console.error(`grade.sh: no cine preset "${P}" (${Object.keys(LOOK).filter(n => LOOK[n].curves)})`); process.exit(1); }
const pts = ch => L.curves[ch].map(([x, y]) => `${x}/${(x + (y - x) * k).toFixed(4)}`).join(" ");
const [a, m, b] = (L.sat || [1, 1, 1]).map(v => (1 + (v - 1) * k).toFixed(3)), Y = "lum(X,Y)";
const S = `if(lt(${Y},128),${a}+(${m}-${a})*${Y}/128,${m}+(${b}-${m})*(${Y}-128)/127)`;
const f = [`format=gbrp,curves=r=\x27${pts("r")}\x27:g=\x27${pts("g")}\x27:b=\x27${pts("b")}\x27`];
if (L.halation) f.push(`split[o][h];[h]lutrgb=r=\x27if(gt(val,200),(val-200)*5,0)\x27:g=\x27if(gt(val,215),(val-215)*2,0)\x27:b=0,gblur=sigma=14[g];[o][g]blend=all_mode=screen:all_opacity=${(L.halation * k).toFixed(3)}`);
f.push(`format=yuv444p,geq=lum=\x27lum(X,Y)\x27:cb=\x27128+(cb(X,Y)-128)*${S}\x27:cr=\x27128+(cr(X,Y)-128)*${S}\x27`);
if (L.vignette) f.push(`vignette=angle=${(L.vignette * k * Math.PI / 3.5).toFixed(3)}`);
if (L.grain) f.push(`noise=c0s=${Math.round(L.grain * k * 133)}:c0f=t+u`);
if (+BARS) f.push(`drawbox=x=0:y=0:w=iw:h=max(0\\,(ih-iw/${BARS})/2):color=black:t=fill,drawbox=x=0:y=ih-max(0\\,(ih-iw/${BARS})/2):w=iw:h=max(0\\,(ih-iw/${BARS})/2):color=black:t=fill`);
console.log(f.join(",") + ",format=yuv420p");
' "$(dirname "$0")/look.js" "$P" "$K" "$BARS")
ffmpeg -loglevel error -y -i "$IN" -vf "$VF" -map 0:v -map 0:a? -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a copy "$OUT"
