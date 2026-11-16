import { ReplayPreview } from "@brett_lamy/ui/docstream"
import { replayDemoEvents } from "@brett_lamy/ui/docstream/replay/demo"

// The recording is 8.6 s; the part that matters is the promo code and the failed checkout.
export default function TimeWindowDemo() {
  return <ReplayPreview events={replayDemoEvents} timeWindow={[6200, 8000]} title="Checkout, the failing segment" />
}
