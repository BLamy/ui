import { TuiPreview } from '@/components/ui/tui-preview'
import { program } from './program'

export default function Keyboard() {
  return <TuiPreview
    code={program}
    title="Interactive OpenTUI counter"
    height={300}
    runtimeUrl={import.meta.env.VITE_OPENTUI_RUNTIME_URL}
  />
}
