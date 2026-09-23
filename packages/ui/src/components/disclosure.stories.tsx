import type { Meta, StoryObj } from '@storybook/react-vite';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Disclosure, DisclosurePanel, DisclosureTrigger } from './disclosure';
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
    <Disclosure defaultExpanded>
      <DisclosureTrigger>Advanced</DisclosureTrigger>
      <DisclosurePanel>Proxy, DNS and certificate settings live here.</DisclosurePanel>
    </Disclosure>
  ),
};

export const Accordions: Story = {
  render: () => (
    <Accordion defaultExpandedKeys={['sync']}>
      {faq.map(([id, q, a]) => (
        <AccordionItem key={id} id={id}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>
      ))}
    </Accordion>
  ),
};

export const Inset: Story = {
  render: () => (
    <Accordion variant="inset" allowsMultipleExpanded defaultExpandedKeys={['sync', 'export']}>
      {faq.map(([id, q, a]) => (
        <AccordionItem key={id} id={id}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>
      ))}
    </Accordion>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (
    <Accordion variant="inset" defaultExpandedKeys={['share']}>
      {faq.map(([id, q, a]) => (
        <AccordionItem key={id} id={id}><AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}</AccordionContent></AccordionItem>
      ))}
    </Accordion>
  ),
};
