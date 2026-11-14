import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Tabs variant={variant} defaultValue="account">
      <TabsList aria-label="Settings">
        {panels.map(([id, t]) => <TabsTab key={id} value={id}>{t}</TabsTab>)}
      </TabsList>
      {panels.map(([id, t, d]) => (
        <TabsPanel key={id} value={id}>
          <Card>
            <CardHeader><CardTitle>{t}</CardTitle><CardDescription>{d}</CardDescription></CardHeader>
            <CardContent className="text-muted-foreground">Content for {t.toLowerCase()}.</CardContent>
          </Card>
        </TabsPanel>
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
