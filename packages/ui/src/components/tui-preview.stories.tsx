import type { Meta, StoryObj } from '@storybook/react-vite';
import { TuiPreview } from '@/components/ui/tui-preview';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof TuiPreview> = {
  title: 'Organisms/TuiPreview',
  component: TuiPreview,
  decorators: [(Story, ctx) => <Panel w={620} dark={ctx.parameters.dark}><Story /></Panel>],
  args: { title: 'Counter', height: 220 },
};
export default meta;
type Story = StoryObj<typeof TuiPreview>;

/* Nothing here runs a program until Run is pressed, so every story is a pure function of its arguments. The error story
   points at a runtime that never answers and gives it a short start-up timeout: press Run to see it. */

const PROGRAM = `import { TextRenderable, createCliRenderer } from "@opentui/core"
const renderer = await createCliRenderer()
let count = 0
const label = new TextRenderable(renderer, { content: "Count: 0  (← →)" })
renderer.root.add(label)
renderer.keyInput.on("keypress", (key) => {
  if (key.name === "right") count++
  if (key.name === "left") count--
  label.content = \`Count: \${count}  (← →)\`
})`;

/** Ready to run: nothing is loaded until the reader presses Run. */
export const Idle: Story = { args: { code: PROGRAM } };

export const IdleDark: Story = { args: { code: PROGRAM }, parameters: { dark: true } };

/** Inside an AI reply that is still streaming: Run waits for the reply to finish. */
export const Streaming: Story = { args: { code: PROGRAM.slice(0, 120), isStreaming: true } };

/** A light frame: `theme` takes concrete colors because the frame has its own origin. */
export const LightTheme: Story = { args: { code: PROGRAM, theme: { mode: 'light', background: '#ffffff', foreground: '#17171c' } } };

/** Press Run: the runtime never reports ready, and after a second the preview says so and offers Retry. */
export const StartupError: Story = {
  args: { code: PROGRAM, runtimeUrl: 'https://runtime.invalid/opentui/', startupTimeoutMs: 1000 },
};
