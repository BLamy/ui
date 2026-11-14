import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchInput } from '@/components/ui/search-input';
import { Icon } from '@/lib/icon';
import { Pad } from '../stories/frame';

const meta: Meta<typeof SearchInput> = {
  title: 'Atoms/SearchInput',
  component: SearchInput,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof SearchInput>;

function Demo({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial || '');
  return <SearchInput value={q} onValueChange={setQ} aria-label="Search contacts" />;
}

export const Empty: Story = { render: () => <Demo /> };
export const WithQuery: Story = { render: () => <Demo initial="Chen" /> };

/** Uncontrolled: `defaultValue` seeds the query, `onValueChange` / `onSubmit` report it. */
export const Uncontrolled: Story = {
  render: () => <SearchInput defaultValue="Wei" aria-label="Search contacts" />,
};

export const Disabled: Story = { render: () => <SearchInput defaultValue="Wei" disabled aria-label="Search contacts" /> };

/** `size="sm"`: the 32px search of a sidebar or a toolbar. */
export const Small: Story = { render: () => <SearchInput size="sm" defaultValue="Wei" aria-label="Search contacts" /> };

/** Focus draws the inset primary ring. */
export const Focused: Story = { render: () => <SearchInput autoFocus aria-label="Search contacts" /> };

/** Your own glyph, and no Clear button (Escape still clears). */
export const CustomIcon: Story = {
  render: () => <SearchInput icon={<Icon name="bubble" size={16} className="shrink-0 text-foreground/70" />} clearable={false} placeholder="Ask anything" aria-label="Ask" />,
};

export const Dark: Story = {
  decorators: [(Story) => <Pad dark><Story /></Pad>],
  render: () => (
    <div className="flex flex-col gap-3">
      <Demo initial="Chen" />
      <SearchInput size="sm" aria-label="Search contacts" />
    </div>
  ),
};
