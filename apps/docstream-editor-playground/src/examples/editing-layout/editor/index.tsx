import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** Tables and GitBook's layout blocks, each with the controls the editor gives it. */
export default function LayoutDemo({ variant = "tables" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "tables") as SampleId
  return <Workbench sample={SAMPLES[id]} height={380} />
}
