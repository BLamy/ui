import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import SaasCheckout from './page';

const meta: Meta<typeof SaasCheckout> = {
  title: 'Blocks/SaaS Checkout',
  component: SaasCheckout,
  parameters: { layout: 'fullscreen' },
  // A fixed billing date so renewal dates and receipts are the same in every frame.
  args: { today: new Date('2026-10-04T10:00:00') },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof SaasCheckout>;

/** The block fills whatever box it's given; these stories give it the viewport or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="overflow-hidden rounded-[28px] shadow-[0_12px_40px_black] shadow-black/18" style={{ width, height }}>{children}</div>
    </div>
  );
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

const ACCOUNT = { email: 'jane@acme-rockets.com', name: 'Jane Appleseed', workspace: 'Acme Rockets' };

/** The plan step: yearly billing, Pro, five seats; the summary sticks beside the form. */
export const Desktop: Story = { render: (args) => <Full><SaasCheckout {...args} /></Full> };
export const DesktopDark: Story = { render: (args) => dark(<Full><SaasCheckout {...args} /></Full>) };

/** The payment step with a promotion applied and a California ZIP, so tax is in the total. */
export const Payment: Story = {
  args: { initialStep: 'payment', initial: { promo: 'LAUNCH20', account: ACCOUNT, card: { name: 'Jane Appleseed' }, billing: { country: 'US', postal: '94107' } } },
  render: (args) => <Full><SaasCheckout {...args} /></Full>,
};

/** Monthly billing on Business: the summary offers the yearly saving. */
export const Monthly: Story = {
  args: { initialStep: 'account', initial: { plan: 'business', cycle: 'monthly', seats: 12 } },
  render: (args) => <Full><SaasCheckout {...args} /></Full>,
};

/** Paid: the receipt. */
export const Receipt: Story = {
  args: { initialStep: 'done', initial: { promo: 'LAUNCH20', account: ACCOUNT, billing: { country: 'GB', postal: 'EC1V 9HX' } } },
  render: (args) => <Full><SaasCheckout {...args} /></Full>,
};

/** iPhone: one column, the summary folded into the bar above the form. */
export const Phone: Story = { render: (args) => <Device width={390} height={844}><SaasCheckout {...args} /></Device> };
export const PhonePayment: Story = {
  args: Payment.args,
  render: (args) => dark(<Device width={390} height={844}><SaasCheckout {...args} /></Device>),
};
