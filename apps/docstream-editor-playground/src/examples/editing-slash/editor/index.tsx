import { SAMPLES, type SampleId } from "./samples"
import { Workbench } from "./Workbench"

/** Type `/` in the editor; the Markdown pane shows what each inserted block serializes to. */
export default function SlashMenuDemo({ variant = "default" }: { variant?: string }) {
  const id = (variant in SAMPLES ? variant : "default") as SampleId
  return <Workbench sample={SAMPLES[id]} height={320} />
}
