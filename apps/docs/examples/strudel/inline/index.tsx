import { StrudelPlayer } from '@/components/ui/strudel-player'

const code = `setcps(.55)
stack(
  s("bd*4, ~ hh*2 ~ hh, ~ cp").gain(.8),
  note("<c2 a1 f1 g1>").s("sawtooth").lpf(700),
  note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>").s("triangle").room(.4).gain(.25)
)`

// Strudel code inline. Press play (sound starts on the press); the code
// button shows the pattern, the sliders button opens the equipment rack.
export default function Inline() {
  return (
    <div style={{ width: '100%', maxWidth: 720 }}>
      <StrudelPlayer code={code} title="Four on the floor" />
    </div>
  )
}
