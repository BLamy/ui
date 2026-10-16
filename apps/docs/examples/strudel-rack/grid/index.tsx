import { useEffect, useState } from 'react'
import { StrudelRack } from '@/components/ui/strudel-rack'
import { playStrudel, stopStrudel, updateStrudel } from '@/components/ui/strudel-player'
import { Button } from '@/components/ui/button'

const initial = `setcps(.5)
stack(
  s("bd*2 [~ bd] sd ~, hh*8").gain(.8).room(.2),
  n("<0 3 4 3>").scale("G2:minor").s("sawtooth").lpf(sine.range(300, 900).slow(8)),
  n("<[0,2,4] [3,5,7]>").scale("G3:minor").s("triangle").room(.4).gain(.3),
  n("[1 ~ 6 2 ~ ~ ~ 3]").scale("G4:minor").s("square").delay(.35).lpf(2200).pan(.3).gain(.2)
).postgain(.9)`

// The rack on its own, on the masonry grid: drag a module by its title,
// resize it from its corner. Every knob, pad and step rewrites the code
// below, and while it plays the change is live.
export default function Grid() {
  const [code, setCode] = useState(initial)
  const [playable, setPlayable] = useState(initial)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (playing) void updateStrudel('rack-demo', playable)
  }, [playable, playing])
  useEffect(() => () => void stopStrudel('rack-demo'), [])

  const toggle = async () => {
    if (playing) {
      await stopStrudel('rack-demo')
      setPlaying(false)
    } else {
      setPlaying(true)
      await playStrudel('rack-demo', playable).catch(() => setPlaying(false))
    }
  }

  return (
    <div style={{ width: '100%', display: 'grid', gap: 12 }}>
      <Button variant="secondary" onPress={toggle} style={{ justifySelf: 'start' }}>{playing ? 'Stop' : 'Play'}</Button>
      <StrudelRack code={code} onChange={setCode} onPlayableChange={setPlayable} layout="grid" />
      <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{code}</pre>
    </div>
  )
}
