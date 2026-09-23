import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabList, Tab, TabPanel } from './tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Tabs> = {
  title: 'Molecules/Tabs',
  component: Tabs,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Tabs>;

function Demo({ variant }: { variant: 'segmented' | 'underline' }) {
  const panels = [
    ['account', 'Account', 'Name, email and password.'],
    ['privacy', 'Privacy', 'Who can see your activity.'],
    ['billing', 'Billing', 'Plan, invoices and payment.'],
  ];
  return (
    <Tabs variant={variant} defaultSelectedKey="account">
      <TabList aria-label="Settings">
        {panels.map(([id, t]) => <Tab key={id} id={id}>{t}</Tab>)}
      </TabList>
      {panels.map(([id, t, d]) => (
        <TabPanel key={id} id={id}>
          <Card>
            <CardHeader><CardTitle>{t}</CardTitle><CardDescription>{d}</CardDescription></CardHeader>
            <CardContent className="text-muted-foreground">Content for {t.toLowerCase()}.</CardContent>
          </Card>
        </TabPanel>
      ))}
    </Tabs>
  );
}

export const Segmented: Story = { render: () => <Demo variant="segmented" /> };
export const Underline: Story = { render: () => <Demo variant="underline" /> };
export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (<div className="flex flex-col gap-8"><Demo variant="segmented" /><Demo variant="underline" /></div>),
};
