import type { PlayerAudio, VideoScene } from "@brett_lamy/viz-engine"
import { VizPlayer } from "@brett_lamy/viz-engine"

export interface VizEmbedProps {
  scene: VideoScene
  audio?: PlayerAudio
  title?: string
  className?: string
  autoplay?: boolean
  loop?: boolean
  showCaptions?: boolean
}

/**
 * Mount a deterministic VizEngine scene inside a Docstream document. This is
 * intentionally a component API rather than a markdown escape hatch: callers
 * choose the scene and its evidence, while Docstream supplies document chrome
 * and accessible figure semantics.
 */
export function VizEmbed({
  scene,
  audio,
  title,
  className,
  autoplay = true,
  loop = true,
  showCaptions = false,
}: VizEmbedProps) {
  return (
    <figure className={`docstream-viz ${className ?? ""}`.trim()}>
      <VizPlayer
        scene={scene}
        {...(audio === undefined ? {} : { audio })}
        autoplay={autoplay}
        loop={loop}
        showCaptions={showCaptions}
        className="docstream-viz__player"
      />
      {title && <figcaption>{title}</figcaption>}
    </figure>
  )
}
