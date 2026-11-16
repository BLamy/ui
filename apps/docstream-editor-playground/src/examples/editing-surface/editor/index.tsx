import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** The editor beside the Markdown it writes. Each variant loads a different starting document. */
export default function EditingSurface({ variant = "blocks" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "blocks") as SampleId
  return <Workbench sample={SAMPLES[id]} height={400} />
}
