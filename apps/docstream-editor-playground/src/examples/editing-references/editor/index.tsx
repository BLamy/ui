import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** @mentions, #tags, $codebases and [^n] citations, with the menus fed by the host. */
export default function ReferencesDemo({ variant = "freeform" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "freeform") as SampleId
  return <Workbench sample={SAMPLES[id]} height={320} />
}
