import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from '@/components/ui/search-field';
import { Pad } from '../stories/frame';

const meta: Meta<typeof SearchField> = {
  title: 'Atoms/SearchField',
  component: SearchField,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof SearchField>;

function Demo({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial || '');
  return <SearchField value={q} onChange={setQ} aria-label="Search contacts" />;
}

export const Empty: Story = { render: () => <Demo /> };
export const WithQuery: Story = { render: () => <Demo initial="Chen" /> };

/** Uncontrolled: `defaultValue` seeds the query, `onChange` / `onSubmit` report it. */
export const Uncontrolled: Story = {
  render: () => <SearchField defaultValue="Wei" onChange={() => undefined} aria-label="Search contacts" />,
};
