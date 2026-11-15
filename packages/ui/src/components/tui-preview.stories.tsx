import type { Meta, StoryObj } from '@storybook/react-vite';
import { TuiPreview } from '@/components/ui/tui-preview';
import { Panel } from '../stories/primitive-frame';
import { Phone } from '../stories/frame';

const meta: Meta<typeof TuiPreview> = {
  title: 'Organisms/TuiPreview',
  component: TuiPreview,
  decorators: [
    (Story, ctx) =>
      ctx.parameters.phone ? (
        <Phone appearance={ctx.parameters.dark ? 'dark' : 'light'}>
          <div className="bl-scroll absolute inset-0 overflow-y-auto p-5"><Story /></div>
        </Phone>
      ) : (
        <Panel w={620} dark={ctx.parameters.dark}><Story /></Panel>
      ),
  ],
  args: { title: 'Counter', height: 220 },
  argTypes: {
    appearance: { control: 'inline-radio', options: ['auto', 'light', 'dark'] },
    onStateChange: { control: false },
  },
};
export default meta;
type Story = StoryObj<typeof TuiPreview>;

/* Nothing here runs a program until Run is pressed, so every story is a pure function of its arguments. The error
   stories point at a runtime that never answers and give it a short start-up timeout: press Run to see them. The
   terminal follows the frame's appearance (`appearance="auto"`, the default) unless a story forces one. */

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

/** Ready to run: nothing is loaded until the reader presses Run. On a light page the terminal is light. */
export const Idle: Story = { args: { code: PROGRAM } };

/** The same preview on a dark page: the terminal follows it. */
export const IdleDark: Story = { args: { code: PROGRAM }, parameters: { dark: true } };

/** `appearance="dark"` keeps a black terminal on a light page. */
export const ForcedDark: Story = { args: { code: PROGRAM, appearance: 'dark' } };

/** Inside an AI reply that is still streaming: Run waits for the reply to finish. */
export const Streaming: Story = { args: { code: PROGRAM.slice(0, 120), streaming: true } };

/** Press Run: the runtime never reports ready, and after a second the preview shows an alert and offers Retry. */
export const StartupError: Story = {
  args: { code: PROGRAM, runtimeUrl: 'https://runtime.invalid/opentui/', startupTimeoutMs: 1000 },
};

export const StartupErrorDark: Story = { ...StartupError, parameters: { dark: true } };

/** In a phone-sized frame: the toolbar and the source disclosure wrap to the width. */
export const PhoneFrame: Story = { args: { code: PROGRAM, height: 260 }, parameters: { phone: true } };

export const PhoneFrameDark: Story = { args: { code: PROGRAM, height: 260 }, parameters: { phone: true, dark: true } };
