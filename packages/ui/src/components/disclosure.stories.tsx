import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DisclosureGroup, DisclosureGroupHeader, DisclosureGroupItem, DisclosureGroupPanel, DisclosureGroupTrigger, Disclosure, DisclosurePanel, DisclosureTrigger,
} from '@/components/ui/disclosure';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Disclosure> = {
  title: 'Molecules/Disclosure',
  component: Disclosure,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Disclosure>;

const faq = [
  ['sync', 'How does iCloud sync work?', 'Changes upload in the background and appear on your other devices within seconds.'],
  ['share', 'Can I share a list?', 'Yes — invite people from the Share menu; they can view or edit.'],
  ['export', 'How do I export my data?', 'Settings → Privacy → Export Data creates a zip of everything.'],
];

export const Single: Story = {
  render: () => (
    <Disclosure defaultOpen>
      <DisclosureTrigger>Advanced</DisclosureTrigger>
      <DisclosurePanel>Proxy, DNS and certificate settings live here.</DisclosurePanel>
    </Disclosure>
  ),
};

export const Accordions: Story = {
  render: () => (
    <DisclosureGroup defaultValue={['sync']}>
      {faq.map(([id, q, a]) => (
        <DisclosureGroupItem key={id} value={id}>
          <DisclosureGroupHeader><DisclosureGroupTrigger>{q}</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>{a}</DisclosureGroupPanel>
        </DisclosureGroupItem>
      ))}
    </DisclosureGroup>
  ),
};

export const Inset: Story = {
  render: () => (
    <DisclosureGroup variant="inset" multiple defaultValue={['sync', 'export']}>
      {faq.map(([id, q, a]) => (
        <DisclosureGroupItem key={id} value={id}>
          <DisclosureGroupHeader><DisclosureGroupTrigger>{q}</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>{a}</DisclosureGroupPanel>
        </DisclosureGroupItem>
      ))}
    </DisclosureGroup>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (
    <DisclosureGroup variant="inset" defaultValue={['share']}>
      {faq.map(([id, q, a]) => (
        <DisclosureGroupItem key={id} value={id}>
          <DisclosureGroupHeader><DisclosureGroupTrigger>{q}</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>{a}</DisclosureGroupPanel>
        </DisclosureGroupItem>
      ))}
    </DisclosureGroup>
  ),
};
