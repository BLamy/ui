import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BLProvider } from '@/lib/theme';
import CloudflareStudio from './page';

const meta: Meta<typeof CloudflareStudio> = {
  title: 'Blocks/Cloudflare Studio',
  component: CloudflareStudio,
  parameters: { layout: 'fullscreen' },
  // Nothing's kept between stories, so each one's what it says.
  args: { storageKey: null },
};
export default meta;
type Story = StoryObj<typeof CloudflareStudio>;

function Full({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <BLProvider appearance={dark ? 'dark' : undefined}><div className="h-screen w-full">{children}</div></BLProvider>;
}
function Phone({ children }: { children: ReactNode }) {
  return <BLProvider><div className="relative h-[720px] w-[390px] overflow-hidden">{children}</div></BLProvider>;
}

/** The file upload it opens with: a Worker, R2, a Queue, a consumer, D1 and a Durable Object with a machine. */
export const Example: Story = { render: (args) => <Full><CloudflareStudio {...args} /></Full> };

export const Dark: Story = { render: (args) => <Full dark><CloudflareStudio {...args} /></Full> };

/** Nothing yet: search the catalog to add a service. */
export const Empty: Story = {
  args: { initial: { name: 'Untitled system', system: { services: [], edges: [] } } },
  render: (args) => <Full><CloudflareStudio {...args} /></Full>,
};

/** At a phone's width, the inspector's a tray under the board. */
export const AtAPhonesWidth: Story = { render: (args) => <Phone><CloudflareStudio {...args} /></Phone> };
