/* The studio's starter songs: plain Strudel code, the same text you would paste into strudel.cc. */
export interface StudioSong { id: string; title: string; code: string }

export const SONGS: StudioSong[] = [
  {
    id: 'night-drive',
    title: 'Night drive',
    code: `setcps(.5)
stack(
  s("bd*2 [~ bd] sd ~, hh*8").gain(.8).room(.2),
  n("<0 3 4 3>").scale("G2:minor").s("sawtooth").lpf(sine.range(300, 900).slow(8)),
  n("<[0,2,4] [3,5,7] [4,6,8] [3,5,7]>").scale("G3:minor").s("triangle").room(.4).gain(.28),
  n("<[1 ~ 6 2 ~ ~ ~ 3] [3 ~ 6 4 ~ ~ ~ 5]>").scale("G4:minor").s("square").delay(.35).lpf(2200).pan(.35).gain(.2)
).postgain(.9)`,
  },
  {
    id: 'four-floor',
    title: 'Four on the floor',
    code: `setcpm(128/4)
kick: s("bd*4").gain(.95)
hats: s("~ hh ~ hh, hh*16").gain(.45).pan(.6)
clap: s("~ cp ~ cp").room(.3)
bass: note("<c2 c2 a1 [f1 g1]>*2").s("sawtooth").lpf(600).lpq(8).gain(.7)
stab: note("<[c4,e4,g4] ~ [a3,c4,e4] ~>").s("square").lpf(1800).delay(.4).delaytime(.1875).gain(.22)`,
  },
  {
    id: 'lofi',
    title: 'Lo-fi study',
    code: `setcps(.36)
stack(
  s("bd ~ ~ bd ~ ~ [~ bd] ~, ~ ~ sd ~, hh*4").gain(.6).crush(10),
  n("<0 5 3 4>").scale("Eb2:dorian").s("sine").gain(.8),
  n("<[0,2,4,6] [5,7,9,11] [3,5,7,9] [4,6,8,10]>").scale("Eb3:dorian").s("triangle").room(.6).size(4).gain(.22),
  n("[4 ~ 2 ~] [~ 6 5 ~]").scale("Eb4:dorian").s("sine").vib(5).vibmod(.12).delay(.5).gain(.25)
)`,
  },
  {
    id: 'drift',
    title: 'Drift',
    code: `setcps(.2)
stack(
  n("<0 4 5 3>").scale("F2:lydian").s("sine").attack(.8).release(2).gain(.5),
  n("<[0,2,4] [4,6,8] [5,7,9] [3,5,7]>").scale("F3:lydian").s("sawtooth").lpf(900).attack(1.2).release(3).room(.9).size(6).gain(.16),
  n("[3 ~ 2 ~ ~ 6 ~ ~]").scale("F4:lydian").s("sine").delay(.6).delayfeedback(.6).room(.8).gain(.22)
)`,
  },
];
