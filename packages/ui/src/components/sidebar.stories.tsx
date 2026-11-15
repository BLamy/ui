import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarItem, SidebarProvider, SidebarSearch,
  SidebarSection, SidebarTrigger, SidebarAccount, type SidebarPresentation, type SidebarVariant,
} from '@/components/ui/sidebar';
import { BLProvider, ThemeScope } from '@/lib/theme';

type Args = { variant: SidebarVariant; presentation: SidebarPresentation; open: boolean; dark: boolean };

const meta: Meta<Args> = {
  title: 'Organisms/Sidebar',
  component: Sidebar as never,
  args: { variant: 'docked', presentation: 'auto', open: true, dark: false },
  argTypes: {
    variant: { control: 'inline-radio', options: ['docked', 'rail', 'float'] },
    presentation: { control: 'inline-radio', options: ['auto', 'column', 'drawer'] },
  },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<Args>;

/** A framed app, `w` wide at most (it narrows with the viewport) and `h` tall; a phone frame fills the viewport. */
function Frame({ w, h, dark, children }: { w: number; h: number; dark?: boolean; children?: ReactNode }) {
  const phone = w < 600;
  return (
    <div className={phone ? undefined : 'p-6'}>
      <div className={phone ? 'relative mx-auto overflow-hidden' : 'relative mx-auto overflow-hidden rounded-[20px] shadow-hairline'}
        style={{ maxWidth: w, height: phone ? '100vh' : h, maxHeight: h }}>
        <BLProvider dark={dark}>{children}</BLProvider>
      </div>
    </div>
  );
}

const PIPELINE = [
  { icon: 'house', title: 'Overview' },
  { icon: 'briefcase', title: 'Deals', trailing: 3 },
  { icon: 'person-bust', title: 'Contacts' },
  { icon: 'calendar', title: 'Meetings', trailing: 12 },
] as const;
const REPORTS = [
  { icon: 'chart-bar', title: 'Forecast' },
  { icon: 'globe', title: 'Regions' },
] as const;

/** A CRM's navigation: a workspace, a search, two sections with counts, an account in the footer. */
function CrmShell({ variant, presentation, open: initial, breakpoint = 560 }: Omit<Args, 'dark'> & { breakpoint?: number }) {
  const [open, setOpen] = useState(initial);
  const [page, setPage] = useState('Deals');
  return (
    <SidebarProvider open={open} onOpenChange={setOpen} breakpoint={breakpoint}>
      <Sidebar variant={variant} presentation={presentation} width={236}>
        <SidebarHeader>
          <SidebarAccount title="Northwind" description="Sales · Pro plan" />
        </SidebarHeader>
        <SidebarContent aria-label="Northwind">
          <SidebarSearch placeholder="Search deals" shortcut="/" />
          <SidebarItem icon="plus" title="New deal" tint="var(--primary)" />
          <SidebarSection title="Pipeline">
            {PIPELINE.map((p) => (
              <SidebarItem key={p.title} icon={p.icon} title={p.title} trailing={'trailing' in p ? p.trailing : undefined}
                current={page === p.title} onClick={() => setPage(p.title)} />
            ))}
          </SidebarSection>
          <SidebarSection title="Reports">
            {REPORTS.map((p) => (
              <SidebarItem key={p.title} icon={p.icon} title={p.title} current={page === p.title} onClick={() => setPage(p.title)} />
            ))}
            <SidebarItem icon="lock" title="Archive" description="Read-only since May" disabled />
          </SidebarSection>
        </SidebarContent>
        <SidebarFooter>
          <SidebarItem icon={<Avatar name="Ada Lovelace" size={20} />} title="Ada Lovelace" description="ada@northwind.dev" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
          <SidebarTrigger shortcut="mod+b" />
          <span className="text-subhead font-semibold text-foreground">{page}</span>
        </header>
        <div className="flex flex-col gap-3 p-4">
          {['Northwind renewal', 'Acme expansion', 'Globex pilot'].map((d) => (
            <div key={d} className="rounded-ctl bg-muted px-3 py-2.5 text-footnote text-foreground">{d}</div>
          ))}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const render: Story['render'] = ({ dark, ...args }) => (
  <Frame w={960} h={560} dark={dark}><CrmShell key={JSON.stringify(args)} {...args} /></Frame>
);

/** The docked column, open: sections, counts, the current row, an action row, a disabled row and a footer. */
export const Expanded: Story = { render };

/** `variant="rail"` closed: the same rows cut to their icons (each named, with a tooltip), section labels as hairlines. */
export const RailCollapsed: Story = { args: { variant: 'rail', open: false }, render };

/** `variant="rail"` open: a full column that the trigger collapses back to its icons. */
export const RailExpanded: Story = { args: { variant: 'rail' }, render };

/** `variant="float"`: an inset card with its own border and radius. */
export const Float: Story = { args: { variant: 'float' }, render };

/** A closed docked sidebar slides away toward the start and leaves the page the whole width. */
export const Closed: Story = { args: { open: false }, render };

export const Dark: Story = { args: { dark: true }, render };

export const DarkRailCollapsed: Story = { args: { dark: true, variant: 'rail', open: false }, render };

/** On a phone (a compact provider) `presentation="auto"` is a drawer over the page, with 44px rows. */
export const PhoneDrawer: Story = {
  render: ({ dark }) => <Frame w={390} h={844} dark={dark}><CrmShell variant="docked" presentation="auto" open /></Frame>,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const PhoneDrawerDark: Story = {
  args: { dark: true },
  render: ({ dark }) => <Frame w={390} h={844} dark={dark}><CrmShell variant="docked" presentation="auto" open /></Frame>,
};

/** On a phone, closed: the page and its sidebar button. */
export const PhoneClosed: Story = {
  render: ({ dark }) => <Frame w={390} h={844} dark={dark}><CrmShell variant="docked" presentation="auto" open={false} /></Frame>,
};

/** `presentation="drawer"` on a wide provider: an overlay sidebar beside a full-width page. */
export const DrawerOnWide: Story = { args: { presentation: 'drawer' }, render };

/** In a `workbench` theme scope, the Workbench palette. */
export const Workbench: Story = {
  args: { dark: true },
  render: ({ dark, ...args }) => (
    <Frame w={960} h={560} dark={dark}>
      <ThemeScope scope="workbench" appearance={dark ? 'dark' : 'light'} className="h-full">
        <CrmShell {...args} />
      </ThemeScope>
    </Frame>
  ),
};
