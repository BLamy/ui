#!/usr/bin/env bash
# Builds the browser FFmpeg/FFprobe that lib/ffmpeg runs, with emcc on PATH: inside emscripten/emsdk, or on the host
# with an activated emsdk (tools/ffmpeg-wasm/build.mjs does either). Sources and objects stay in $CACHE, the generated
# files land in $OUT.
#
# It is openclaw/ffmpeg-wasm's build (https://github.com/openclaw/ffmpeg-wasm, scripts/build.ts, MIT) for the browser
# only, with the same pinned refs, codecs and pthread/ES-module output, plus what an editor's render needs: the
# concat/trim/setpts/fade/xfade/overlay/amix/volume/atempo filters, the AAC, MJPEG and GIF encoders, still-image
# inputs, and WORKERFS so a worker can mount File objects instead of copying them into memory. FFmpeg is LGPL-2.1+,
# libvpx BSD, LAME LGPL; their licence files are copied next to the output. No --enable-gpl, no --enable-nonfree.
set -euo pipefail

FFMPEG_VERSION="${FFMPEG_VERSION:-n9.0.2}"
LAME_REF="${LAME_REF:-2badea1974ae36cb8312afe99cff1e6b3b5decee}"
LIBVPX_REF="${LIBVPX_REF:-v1.17.0}"
CACHE="${CACHE:-/cache}"
OUT="${OUT:-/out}"
PREFIX="$CACHE/prefix"
JOBS="$(getconf _NPROCESSORS_ONLN)"

# The emsdk image lacks pkg-config (FFmpeg falls back to plain -l checks without it, but says so).
if ! command -v pkg-config >/dev/null && [ "$(id -u)" = 0 ] && command -v apt-get >/dev/null; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq pkg-config >/dev/null
fi

checkout() { # dir repo ref
  if [ ! -d "$1/.git" ]; then git clone --filter=blob:none --no-checkout "$2" "$1"; fi
  git -C "$1" fetch --depth 1 origin "$3"
  git -C "$1" checkout --force --detach FETCH_HEAD
}

mkdir -p "$CACHE"
checkout "$CACHE/FFmpeg" https://github.com/FFmpeg/FFmpeg.git "$FFMPEG_VERSION"
checkout "$CACHE/lame" https://github.com/ffmpegwasm/lame.git "$LAME_REF"
checkout "$CACHE/libvpx" https://chromium.googlesource.com/webm/libvpx "$LIBVPX_REF"

rm -rf "$PREFIX" && mkdir -p "$PREFIX"

# Every object linked into the pthread module needs the wasm atomics ABI, so the libraries build with -pthread too.
(
  cd "$CACHE/lame"
  emmake make distclean >/dev/null 2>&1 || true
  CFLAGS="-Oz -pthread" emconfigure ./configure --prefix="$PREFIX" --host=i686-linux --disable-shared \
    --disable-frontend --disable-analyzer-hooks --disable-dependency-tracking --disable-gtktest
  emmake make -j "$JOBS" install
)

(
  cd "$CACHE/libvpx"
  emmake make clean >/dev/null 2>&1 || true
  emconfigure ./configure --prefix="$PREFIX" --target=generic-gnu --disable-shared --enable-static \
    --disable-examples --disable-tools --disable-docs --disable-unit-tests --disable-vp9 --disable-vp8-decoder \
    --enable-vp8-encoder --disable-multithread --disable-runtime-cpu-detect --disable-webm-io --disable-libyuv \
    --extra-cflags="-Oz -pthread"
  emmake make -j "$JOBS" install
)

DECODERS=h264,hevc,mpeg4,h263,vp8,vp9,aac,mp3,flac,vorbis,opus,alac,pcm_s16le,pcm_s16be,pcm_s24le,pcm_s32le,pcm_f32le,pcm_u8,png,mjpeg,webp,gif,rawvideo,wrapped_avframe
PARSERS=h264,hevc,mpeg4video,h263,vp8,vp9,aac,mpegaudio,opus,vorbis,flac,png,mjpeg,webp,gif
DEMUXERS=mov,matroska,mp3,wav,flac,ogg,aac,mpegts,hls,image2,gif,concat
MUXERS=null,rawvideo,image2,wav,segment,mp3,mov,mp4,ipod,webm,gif
ENCODERS=mpeg4,png,mjpeg,gif,rawvideo,wrapped_avframe,pcm_s16le,libmp3lame,libvpx_vp8,opus,aac
# openclaw's set, then the editor's: cut and join, retime, fades and transitions, layout and compositing, audio
# levels and mixing, colour looks, filmstrips (tile) and GIF palettes.
FILTERS=scale,format,select,showinfo,signalstats,metadata,null,aresample,aformat,testsrc2,sine
FILTERS=$FILTERS,concat,trim,atrim,setpts,asetpts,fps,split,asplit,anull,tpad,apad,aselect
FILTERS=$FILTERS,fade,afade,xfade,acrossfade
FILTERS=$FILTERS,pad,crop,setsar,setdar,hflip,vflip,transpose,rotate,overlay,color,anullsrc
FILTERS=$FILTERS,volume,amix,pan,atempo,adelay
FILTERS=$FILTERS,hue,colorchannelmixer,curves,gblur
FILTERS=$FILTERS,tile,palettegen,paletteuse

(
  cd "$CACHE/FFmpeg"
  emmake make distclean >/dev/null 2>&1 || true
  PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" emconfigure ./configure \
    --target-os=none --arch=x86_32 --enable-cross-compile --disable-x86asm --disable-inline-asm --disable-stripping \
    --disable-doc --disable-debug --disable-autodetect --disable-all --disable-network --disable-iconv \
    --disable-runtime-cpudetect \
    --enable-ffmpeg --enable-ffprobe --disable-ffplay \
    --enable-avcodec --enable-avdevice --enable-avformat --enable-avfilter --enable-swresample --enable-swscale \
    --enable-decoder="$DECODERS" --enable-parser="$PARSERS" --enable-demuxer="$DEMUXERS" --enable-indev=lavfi \
    --enable-muxer="$MUXERS" --enable-encoder="$ENCODERS" --enable-protocol=file,data,pipe,fd \
    --enable-filter="$FILTERS" \
    --enable-zlib --enable-libmp3lame --enable-libvpx \
    --cc=emcc --cxx=em++ --ar=emar --ranlib=emranlib --nm=emnm --pkg-config-flags=--static --optflags=-Oz \
    --enable-pthreads --disable-w32threads --disable-os2threads \
    --extra-cflags="-Oz -pthread -sUSE_ZLIB=1 -I$PREFIX/include" \
    --extra-ldflags="-Oz -pthread -sUSE_ZLIB=1 -L$PREFIX/lib"
  # openclaw's browser link flags, plus WORKERFS, bigger stacks for the decoders' threads and a 64 MB start heap.
  emmake make -j "$JOBS" ffmpeg ffprobe \
    LDEXEFLAGS="-Oz -pthread -sUSE_ZLIB=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=5MB -sDEFAULT_PTHREAD_STACK_SIZE=2MB -sPTHREAD_POOL_SIZE=4 -sPROXY_TO_PTHREAD=1 -sEXIT_RUNTIME=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain -sENVIRONMENT=web,worker -lworkerfs.js"
)

mkdir -p "$OUT"
for tool in ffmpeg ffprobe; do
  cp "$CACHE/FFmpeg/$tool" "$OUT/$tool.js"
  cp "$CACHE/FFmpeg/${tool}_g.wasm" "$OUT/${tool}_g.wasm"
  # The pthread workers load the script by its link name (`ffmpeg_g`, no extension), which a static host serves with
  # no JavaScript MIME type and a module worker then refuses: point them at the script itself instead.
  perl -pi -e "s/new URL\\(\"${tool}_g\",import\.meta\.url\\)/new URL(import.meta.url)/g" "$OUT/$tool.js"
  if grep -q "\"${tool}_g\"" "$OUT/$tool.js"; then echo "$tool.js still loads ${tool}_g" >&2; exit 1; fi
done
cp "$CACHE/FFmpeg/LICENSE.md" "$OUT/LICENSE.ffmpeg.md"
cp "$CACHE/FFmpeg/COPYING.LGPLv2.1" "$OUT/COPYING.LGPLv2.1"
cp "$CACHE/libvpx/LICENSE" "$OUT/LICENSE.libvpx"
cp "$CACHE/libvpx/PATENTS" "$OUT/PATENTS.libvpx"
cp "$CACHE/lame/COPYING" "$OUT/COPYING.lame"
cat >"$OUT/BUILD.txt" <<EOF
FFmpeg $FFMPEG_VERSION (LGPL-2.1-or-later), LAME $LAME_REF (LGPL), libvpx $LIBVPX_REF (BSD), Emscripten $(emcc --version | head -1 | sed 's/.*) //')
Built by tools/ffmpeg-wasm/build.sh (after openclaw/ffmpeg-wasm scripts/build.ts). Sources:
  https://github.com/FFmpeg/FFmpeg/tree/$FFMPEG_VERSION
  https://github.com/ffmpegwasm/lame/tree/$LAME_REF
  https://chromium.googlesource.com/webm/libvpx/+/refs/tags/$LIBVPX_REF
decoders: $DECODERS
demuxers: $DEMUXERS
muxers: $MUXERS
encoders: $ENCODERS
filters: $FILTERS
EOF
ls -la "$OUT"
