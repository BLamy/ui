import type { CSSProperties } from "react"

export interface VideoEmbedProps {
  /** A direct media asset or a public player URL. */
  src: string
  title?: string
  className?: string
  /** CSS aspect-ratio for iframe embeds. Defaults to 16 / 9. */
  aspectRatio?: CSSProperties["aspectRatio"]
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  poster?: string
  allowFullScreen?: boolean
}

function isDirectVideo(src: string): boolean {
  return /\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(src)
}

export function VideoEmbed({
  src,
  title = "Video",
  className,
  aspectRatio = "16 / 9",
  controls = true,
  autoplay = false,
  loop = false,
  muted = false,
  poster,
  allowFullScreen = true,
}: VideoEmbedProps) {
  const mediaClass = `video-embed__media ${className ?? ""}`.trim()
  if (isDirectVideo(src)) {
    return (
      <video
        className={mediaClass}
        src={src}
        title={title}
        controls={controls}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        poster={poster}
        playsInline
      />
    )
  }
  return (
    <iframe
      className={mediaClass}
      src={src}
      title={title}
      loading="lazy"
      allow="autoplay; fullscreen"
      allowFullScreen={allowFullScreen}
      style={{ aspectRatio }}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
