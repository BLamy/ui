import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import VideoEditor from './page';

/* Storybook isn't cross-origin isolated, so FFmpeg can't run here: the editor says "Preview only" and these stories
   leave the samples off (`samples: false`), so nothing loads or renders in the background. */
const meta: Meta<typeof VideoEditor> = {
  title: 'Blocks/VideoEditor',
  component: VideoEditor,
  parameters: { layout: 'fullscreen' },
  args: { samples: false, defaultName: 'My Movie' },
};
export default meta;

type Story = StoryObj<typeof VideoEditor>;

/** The block fills whatever box it's given; these stories give it the viewport. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

/** A new project: the media library, an empty viewer, the project inspector and three empty tracks (Titles, the
    magnetic Main track, Music). Drop video, audio or images on the library to start. */
export const Empty: Story = { render: (args) => <Full><VideoEditor {...args} /></Full> };

export const EmptyDark: Story = { render: (args) => dark(<Full><VideoEditor {...args} /></Full>) };
