/* Every song is a Strudel pattern (https://strudel.cc): the album's genre picks the band — tempo, mode, drums,
   instruments — and the track seeds its key, chord progression and melody, so each of the library's songs sounds
   like itself and like its album. Drums use the Tidal dirt-samples; everything else is a built-in synth. */
import type { Song } from './data';

interface Style {
  cps: number;
  mode: string;
  drums: string;
  bass: string;
  chords: string;
  lead: string;
  /** Rests in the melody (0–1); slower, sparser genres leave more air. */
  air: number;
}

const STYLES: Record<string, Style> = {
  Electronic: {
    cps: 0.55, mode: 'minor', air: 0.35,
    drums: 's("bd*4, ~ hh*2 ~ hh, ~ cp").gain(.8)',
    bass: 's("sawtooth").lpf(sine.range(300, 900).slow(8)).struct("x(5,8)")',
    chords: 's("triangle").room(.4).gain(.28)',
    lead: 's("square").delay(.35).delaytime(.1875).lpf(2200).gain(.2)',
  },
  'Indie Pop': {
    cps: 0.5, mode: 'major', air: 0.3,
    drums: 's("bd ~ [~ bd] ~, ~ sd ~ sd, hh*8").gain(.7)',
    bass: 's("triangle").lpf(700).struct("x ~ x x ~ x ~ ~")',
    chords: 's("sawtooth").lpf(1400).room(.3).gain(.18).struct("x ~ x ~")',
    lead: 's("triangle").room(.3).gain(.32)',
  },
  Ambient: {
    cps: 0.22, mode: 'lydian', air: 0.6,
    drums: 's("~").gain(0)',
    bass: 's("sine").attack(.8).release(2).gain(.5)',
    chords: 's("sawtooth").lpf(900).attack(1.2).release(3).room(.9).gain(.16)',
    lead: 's("sine").delay(.6).delayfeedback(.6).room(.8).gain(.22)',
  },
  Americana: {
    cps: 0.45, mode: 'mixolydian', air: 0.35,
    drums: 's("bd ~ bd ~, ~ sd ~ sd, ~ hh ~ hh").gain(.6)',
    bass: 's("triangle").lpf(600).struct("x ~ x ~")',
    chords: 's("sawtooth").lpf(1800).gain(.12).struct("x x ~ x x ~ x ~")',
    lead: 's("triangle").vib(4).vibmod(.15).gain(.3)',
  },
  Synthwave: {
    cps: 0.5, mode: 'minor', air: 0.3,
    drums: 's("bd ~ ~ ~ bd ~ ~ ~, ~ ~ sd ~, hh*8").gain(.75)',
    bass: 's("sawtooth").lpf(800).struct("x*8")',
    chords: 's("sawtooth").lpf(1600).room(.6).gain(.16)',
    lead: 's("square").lpf(2400).delay(.4).room(.4).gain(.18)',
  },
  Jazz: {
    cps: 0.38, mode: 'dorian', air: 0.45,
    drums: 's("[hh ~ hh] [hh ~ hh] [hh ~ hh] [hh ~ hh], ~ ~ ~ [~ sd]").gain(.5)',
    bass: 's("triangle").lpf(500).struct("x x x x")',
    chords: 's("sine").room(.5).gain(.28).struct("~ x ~ [~ x]")',
    lead: 's("triangle").room(.4).gain(.3)',
  },
  Alternative: {
    cps: 0.52, mode: 'aeolian', air: 0.3,
    drums: 's("bd [~ bd] sd ~, hh*8").gain(.8)',
    bass: 's("sawtooth").lpf(500).struct("x*8")',
    chords: 's("square").lpf(1100).room(.3).gain(.14).struct("x ~ x x")',
    lead: 's("sawtooth").lpf(1800).gain(.16)',
  },
  Pop: {
    cps: 0.55, mode: 'major', air: 0.25,
    drums: 's("bd*2 [~ bd] bd, ~ cp ~ cp, hh*8").gain(.75)',
    bass: 's("square").lpf(600).struct("x ~ x x x ~ x ~")',
    chords: 's("sawtooth").lpf(2000).room(.3).gain(.14).struct("~ x ~ x")',
    lead: 's("square").lpf(3000).delay(.25).gain(.2)',
  },
  'R&B/Soul': {
    cps: 0.4, mode: 'dorian', air: 0.4,
    drums: 's("bd ~ ~ bd ~ ~ bd ~, ~ ~ sd ~, hh*4").gain(.65)',
    bass: 's("sine").gain(.8).struct("x ~ ~ x ~ x ~ ~")',
    chords: 's("triangle").room(.5).gain(.26).struct("x ~ ~ ~ ~ x ~ ~")',
    lead: 's("sine").vib(5).vibmod(.1).room(.4).gain(.3)',
  },
  Folk: {
    cps: 0.42, mode: 'major', air: 0.35,
    drums: 's("~ ~ ~ ~").gain(0)',
    bass: 's("triangle").lpf(500).struct("x ~ x ~")',
    chords: 's("triangle").gain(.24).struct("x x x x x x")',
    lead: 's("sine").room(.4).gain(.32)',
  },
};

const ROOTS = ['C', 'D', 'Eb', 'E', 'F', 'G', 'A', 'Bb'];
const PROGRESSIONS = [[0, 5, 3, 4], [0, 3, 4, 3], [5, 3, 0, 4], [0, 4, 5, 3], [0, 2, 3, 4], [3, 4, 0, 0]];

// Small deterministic PRNG so a track always plays the same song.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** The Strudel code for a song. */
export function songCode(song: Song): string {
  const style = STYLES[song.album.genre] ?? STYLES.Electronic;
  const rand = rng(`${song.album.id}:${song.index}`);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const root = pick(ROOTS);
  const prog = pick(PROGRESSIONS);
  const cps = +(style.cps * (0.92 + rand() * 0.16)).toFixed(3);
  const steps = Array.from({ length: 8 }, (_, i) => {
    if (i > 0 && rand() < style.air) return '~';
    // Lean toward chord tones of the first chord; stepwise otherwise.
    return String(Math.floor(rand() * 8));
  });
  const answer = steps.map((s) => (s === '~' || rand() < 0.5 ? s : String(+s + 2)));
  const chords = prog.map((d) => `[${d},${d + 2},${d + 4}]`).join(' ');
  return `setcps(${cps})
stack(
  ${style.drums},
  n("<${prog.join(' ')}>").scale("${root}2:${style.mode}").${style.bass},
  n("<${chords}>").scale("${root}3:${style.mode}").${style.chords},
  n("<[${steps.join(' ')}] [${answer.join(' ')}]>").scale("${root}4:${style.mode}").${style.lead}
)`;
}
