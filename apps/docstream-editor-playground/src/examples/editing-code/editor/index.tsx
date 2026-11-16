import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** Code blocks, install commands, math and Mermaid, each edited with a live preview. */
export default function CodeDemo({ variant = "code" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "code") as SampleId
  // A workerd config's card is its source and a board under it: room for both.
  return <Workbench sample={SAMPLES[id]} height={id === "workerd" ? 640 : 400} />
}
