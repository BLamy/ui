import { HapticsPlayground } from '@brett_lamy/ui'

// Every impact, notification and selection style, with the active engine and a
// live event pill. In your own code it's one engine, three calls — the same
// surface as UIFeedbackGenerator:
//   Haptics.impact('light') · Haptics.notification('success')
//   Haptics.selection()
export default function Playground() {
  return <HapticsPlayground />
}
