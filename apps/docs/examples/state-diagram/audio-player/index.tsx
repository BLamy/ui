import { StateDiagram } from '@/components/ui/state-diagram'
import { AUDIO_PLAYER_SOURCE } from './audio-player-machine'

// The machine from XState's visualizer, from its source: its context under its name, each state's entry actions as chips,
// each transition's label a pill or, with actions, a card. Simulate it: what it can take now is a button on its label.
export default function AudioPlayer() {
  // `?simulate=0` for the picture alone.
  const simulate = new URLSearchParams(window.location.search).get('simulate') !== '0'
  return (
    <div className="relative h-full min-h-[640px] w-full">
      <StateDiagram source={AUDIO_PLAYER_SOURCE} simulate={simulate} defaultPanelOpen={false} aria-label="Audio Player" />
    </div>
  )
}
