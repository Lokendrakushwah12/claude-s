#!/bin/sh
# Film-look post pass for any MP4: the ffmpeg chain tested on 2026-10-10 (refs batch, group D), with every stage scaled by K.
# usage: sh filmlook.sh in.mp4 out.mp4 [K=0.5] [DUST=1]
#   K: strength. 0 leaves the picture as it was, 1 is the full tested look. None of the references used film emulation, so
#   this is a finishing layer, off unless asked for; 0.3–0.6 when it is used. Audio is copied untouched.
# order: gate weave -> print grade -> halation -> chroma fringe -> flicker -> vignette -> luma grain -> dust/scratches
# Two lessons from testing, keep them:
#   - the grain (noise) must come AFTER format=yuv444p; on rgb planes it turns the picture magenta.
#   - the dust blend needs c1/c2 in normal mode at opacity 1; at opacity 0 the grey dust layer's chroma greys the picture.
#   - probe with -of default=nw=1:nk=1: ffprobe 9 prints "1920," in csv=p=0 mode, and the comma breaks scale= and nullsrc=.
# ponytail: geq dust is ~realtime at 960x540, slow at 4K; pass DUST=0, or render dust at half res and scale it up.
set -e
IN="$1"; OUT="$2"; K="${3:-0.5}"; DUST="${4:-1}"
[ -f "$IN" ] && [ -n "$OUT" ] || { echo "usage: sh filmlook.sh in.mp4 out.mp4 [K=0.5] [DUST=1]"; exit 1; }
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$IN")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$IN")
R=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=nw=1:nk=1 "$IN")
D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$IN")
k() { awk "BEGIN { printf \"%g\", $1 }"; } # K-scaled constants (at K=1 they are the tested chain's exact values)
M=$(awk "BEGIN { m = $K * 12; printf \"%d\", (m == int(m)) ? m : int(m) + 1 }")              # weave margin, px per side
SH=$(awk "BEGIN { printf \"%d\", $K + 0.5 }")                                                  # chroma fringe, px
LOOK="[0:v]format=rgb24,
 crop=iw-$((M * 2)):ih-$((M * 2)):${M}+${K}*(4*sin(2*PI*t*0.53)+2*sin(2*PI*t*1.9)):${M}+${K}*(3*sin(2*PI*t*0.71+1.3)+1.5*sin(2*PI*t*2.7)),
 scale=${W}:${H},
 curves=r='0/$(k "0.035*$K") 0.5/$(k "0.5+0.02*$K") 1/$(k "1-0.03*$K")':g='0/$(k "0.03*$K") 0.5/0.5 1/$(k "1-0.04*$K")':b='0/$(k "0.06*$K") 0.5/$(k "0.5-0.03*$K") 1/$(k "1-0.1*$K")',
 split[base][hl];
[hl]lutrgb=r='if(gt(val,200),(val-200)*5,0)':g='if(gt(val,215),(val-215)*2,0)':b=0,gblur=sigma=14[hal];
[base][hal]blend=all_mode=screen:all_opacity=${K}*0.45,
 rgbashift=rh=-${SH}:bh=${SH},
 format=yuv444p,
 eq=eval=frame:contrast=$(k "1+0.05*$K"):saturation=$(k "1-0.12*$K"):brightness='${K}*0.02*(random(0)-0.5)',
 vignette=angle=${K}*PI/5.5:mode=forward,
 noise=c0s=$(awk "BEGIN { printf \"%d\", $K * 12 + 0.5 }"):c0f=t+u,
 format=yuv420p"
if [ "$DUST" = "1" ]; then
  GRAPH="$LOOK[look];
nullsrc=s=${W}x${H}:r=${R}:d=${D},format=gray,
 geq=lum='255*lt(random(1),0.00004) + 200*lt(abs(X-W*(0.15+0.7*abs(sin(floor(N/8)*12.9898)))),0.8)*eq(mod(floor(N/8),3),0)*gt(sin(Y*0.05+N),-0.6)',
 gblur=sigma=0.9,format=yuv420p[dust];
[look][dust]blend=c0_mode=screen:c0_opacity=${K}*0.7:c1_mode=normal:c1_opacity=1:c2_mode=normal:c2_opacity=1[v]"
else
  GRAPH="$LOOK[v]"
fi
ffmpeg -loglevel error -y -i "$IN" -filter_complex "$GRAPH" -map "[v]" -map 0:a? -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a copy "$OUT"
