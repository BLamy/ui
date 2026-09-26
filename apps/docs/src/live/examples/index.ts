/* Every page's example set, merged into the LIVE registry by live-core. */
import type { LiveSpec } from '../frame'
import { ADAPTIVE_PANE_LIVE } from './adaptive-pane'
import { CREDENZA_LIVE } from './credenza'
import { EDGE_DRAWER_LIVE } from './edge-drawer'
import { HAPTICS_LIVE } from './haptics'
import { INTRODUCTION_LIVE } from './introduction'
import { LIST_LIVE } from './list'
import { MARKDOWN_VIEW_LIVE } from './markdown-view'
import { NAVIGATION_STACK_LIVE } from './navigation-stack'
import { PENCILKIT_LIVE } from './pencilkit'
import { SIDE_DRAWER_LIVE } from './side-drawer'
import { SIDEBAR_LIVE } from './sidebar'
import { TAB_VIEW_LIVE } from './tab-view'
import { THEMING_LIVE } from './theming'

export const EXAMPLES_LIVE: Record<string, LiveSpec> = {
  ...INTRODUCTION_LIVE,
  ...THEMING_LIVE,
  ...HAPTICS_LIVE,
  ...MARKDOWN_VIEW_LIVE,
  ...TAB_VIEW_LIVE,
  ...EDGE_DRAWER_LIVE,
  ...NAVIGATION_STACK_LIVE,
  ...LIST_LIVE,
  ...CREDENZA_LIVE,
  ...SIDE_DRAWER_LIVE,
  ...SIDEBAR_LIVE,
  ...ADAPTIVE_PANE_LIVE,
  ...PENCILKIT_LIVE,
}
