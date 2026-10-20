import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** The document properties sheet and the eight task states, both writing back to the Markdown. */
export default function PropertiesDemo({ variant = "properties" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "properties") as SampleId
  return <Workbench sample={SAMPLES[id]} height={380} />
}
