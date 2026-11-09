// Two ways to write tracks: `name:` labels (one device each), or the arguments of one stack(...).
export const SONGS = {
  labels: {
    title: "Night drive",
    code: `setcps(0.5)

drums: s("bd*2 [~ bd] ~ bd, ~ sd").gain(.9)
hats: s("hh*8").gain(.35).pan(.6)
bass: note("<c2 a1 f1 g1>*2").s("sawtooth").lpf(700).lpq(6).decay(.2).sustain(0)
lead: n("<0 2 4 6 7 6 4 2>*2").scale("C:minor").s("triangle").room(.5).delay(.25)
`,
  },
  stack: {
    title: "Four on the floor",
    code: `setcpm(124 / 4)

stack(
  s("bd*4"),
  s("~ cp ~ cp").room(.3),
  s("[~ hh]*4").gain(.5),
  note("<a1 a1 f1 g1>").s("square").lpf(500).decay(.15).sustain(0)
).postgain(.8)
`,
  },
}
