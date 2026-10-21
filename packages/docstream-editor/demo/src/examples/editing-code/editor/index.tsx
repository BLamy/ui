import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** Code blocks, install commands, math and Mermaid, each edited with a live preview. */
export default function CodeDemo({ variant = "code" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "code") as SampleId
  return <Workbench sample={SAMPLES[id]} height={400} />
}
