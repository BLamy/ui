import type { ComponentType, CSSProperties, ReactNode, RefAttributes } from 'react'
import type { ReplayEvent } from './types'

/** Imperative control over a mounted `ReplayStage`. Times are ms from the recording's start. */
export interface ReplayStageHandle {
  /** Play from `offset` (default: the current time; from 0 when at the end). */
  play(offset?: number): void
  /** Pause, optionally jumping to `offset`. */
  pause(offset?: number): void
  /** Jump to `ms`, keeping the play state. */
  seek(ms: number): void
  toggle(): void
  getCurrentTime(): number
  getDuration(): number
  isPlaying(): boolean
  /** The replayed page's document (rrweb's iframe), once the player is up. A stage with no document leaves this out,
   *  and the player has no Elements tab. */
  getDocument?(): Document | null
}

/** A box on the replayed page, in recorded-viewport px: what an overlay is laid out in. */
export interface ReplayElementRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Where DevTools' Elements tab reads from. rrweb's stage has a live document, so its elements know where they are. A
 * host with a picture of the page instead can hand over a `Document` it rebuilt (in a hidden iframe, say), where the
 * layout means nothing, along with where each element really was: its hover outline is then drawn from `getElementRect`.
 */
export interface ReplayElementsSource {
  /** The page at the playhead. Read on every render, so a new one can be handed over at any time. */
  getDocument(): Document | null
  /** Where an element is on the page, or null to draw nothing for it. Default: its `getBoundingClientRect()`. */
  getElementRect?(element: Element): ReplayElementRect | null
}

/** What the player gives a stage of your own. `ReplayStageProps`, less what's only about rrweb. */
export type ReplayCustomStageProps = Pick<
  ReplayStageProps,
  'autoplay' | 'loop' | 'speed' | 'initialTime' | 'overlay' | 'className' | 'style' | 'onReady' | 'onTimeUpdate' | 'onPlayingChange' | 'onFinish'
> & RefAttributes<ReplayStageHandle>

/**
 * A stage to stand in for rrweb's, so the player's chrome, scrubber, keys and markers can drive anything that has a
 * playhead, such as frames from a recording. The player takes its time and play state from the stage's callbacks and
 * drives it through the handle, as it does its own: report the time after every move, whoever made it.
 */
export interface ReplayCustomStage {
  /** Renders the page in the box it's given, with `overlay` over it in recorded-viewport px. Keep it stable: a new
   *  component is a new stage. Say `onReady` when there's something to show. */
  component: ComponentType<ReplayCustomStageProps>
  /** How long the recording is, in ms. */
  duration: number
  /** The page's size in px, when it's known. Default 1280 by 800. It sets the frame's shape with `fit="width"`. */
  width?: number
  height?: number
  /** The address for the URL bar. `url` wins over it. */
  href?: string
}

export interface ReplayStageLayout {
  /** Recorded viewport size (px). */
  width: number
  height: number
  /** How much the viewport is scaled to fit the stage box. */
  scale: number
  /** Where the scaled viewport sits inside the box. */
  offsetX: number
  offsetY: number
}

export interface ReplayStageProps {
  /** rrweb events; appended events are fed to the running player. */
  events: ReplayEvent[]
  autoplay?: boolean
  loop?: boolean
  /** Playback rate (1 = real time). */
  speed?: number
  /** Fast-forward idle stretches longer than 5s (rrweb `skipInactive`). Default true. */
  skipInactive?: boolean
  /** Where the paused player starts (ms). */
  initialTime?: number
  /**
   * `width` (default): scale down to the box width, height follows the recording's aspect.
   * `contain`: fill the box (give it a height) and letterbox the viewport inside it.
   */
  fit?: 'width' | 'contain'
  /** rrweb's own cursor. Hide it when drawing a pointer overlay. Default true. */
  showMouse?: boolean
  /**
   * Rendered over the page, in recorded-viewport coordinates (a box of `width × height` px
   * scaled with the page). `var(--replay-scale)` holds the scale, so an overlay can
   * counter-scale elements that should keep their on-screen size.
   */
  overlay?: ReactNode
  className?: string
  style?: CSSProperties
  /** Shown while the player chunk (rrweb) loads. */
  fallback?: ReactNode
  onReady?(info: { duration: number; width: number; height: number }): void
  /** Every frame while playing, and after each seek/pause. */
  onTimeUpdate?(ms: number): void
  onPlayingChange?(playing: boolean): void
  onFinish?(): void
  onLayout?(layout: ReplayStageLayout): void
}
