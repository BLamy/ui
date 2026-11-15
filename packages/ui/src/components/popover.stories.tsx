import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Popover, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger, createPopoverController,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof PopoverContent> = {
  title: 'Molecules/Popover',
  component: PopoverContent,
};
export default meta;
type Story = StoryObj<typeof PopoverContent>;

function Dimensions({ open = true, arrow = false, presentation }: { open?: boolean; arrow?: boolean; presentation?: 'sheet' }) {
  return (
    <Popover defaultOpen={open} presentation={presentation}>
      <PopoverTrigger render={<Button variant="secondary" />}>Dimensions</PopoverTrigger>
      <PopoverContent align="start" arrow={arrow}>
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription className="mt-1 mb-3">Set the size of the layer.</PopoverDescription>
        <div className="flex flex-col gap-3">
          <Field><FieldLabel>Width</FieldLabel><Input size="sm" defaultValue="320" /></Field>
          <Field><FieldLabel>Height</FieldLabel><Input size="sm" defaultValue="auto" /></Field>
          <Slider label="Opacity" showValue defaultValue={80} />
        </div>
        <PopoverClose render={<Button size="sm" className="mt-4 w-full" />}>Done</PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

export const Open: Story = { render: () => <Screen h={560}><div><Dimensions /></div></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={560}><div><Dimensions /></div></Screen> };
/** `arrow` on the content: a pointer toward the trigger. */
export const Arrow: Story = { render: () => <Screen h={560}><div><Dimensions arrow /></div></Screen> };
/** `presentation="sheet"`: the same content as a bottom sheet, with the Sheet's grabber (`"auto"` picks it in a
    compact container). */
export const AsSheet: Story = { render: () => <Screen h={560}><div><Dimensions presentation="sheet" /></div></Screen> };
export const AsSheetDark: Story = { render: () => <Screen dark h={560}><div><Dimensions presentation="sheet" /></div></Screen> };
export const Closed: Story = { render: () => <Screen h={260}><div><Dimensions open={false} /></div></Screen> };

const FILTERS = ['Unread', 'Flagged', 'From VIPs', 'With attachments'];

/** `variant="plain"`: the surface without padding or a width of its own, at least as wide as its trigger, for a list or a layout that pads itself. */
function Filters({ dark = false }: { dark?: boolean }) {
  return (
    <Screen dark={dark} h={420}>
      <div>
        <Popover defaultOpen>
          <PopoverTrigger render={<Button variant="secondary" />}>
            <Icon name="filter-circle" size={18} /> Filters
          </PopoverTrigger>
          <PopoverContent variant="plain" align="start" className="w-56 py-1.5">
            <PopoverTitle className="sr-only">Filters</PopoverTitle>
            {FILTERS.map((f) => (
              <Label key={f} variant="control" className="flex min-h-11 items-center gap-3 px-4 text-body text-foreground">
                <Checkbox defaultChecked={f === 'Unread'} />
                {f}
              </Label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </Screen>
  );
}
export const Plain: Story = { render: () => <Filters /> };
export const PlainDark: Story = { render: () => <Filters dark /> };

/** One popover for many triggers: each row's trigger hands the content its `payload` through a controller. */
function SharedRows() {
  const [share] = useState(() => createPopoverController<{ file: string }>());
  // The second row's trigger is pressed once mounted, so the story shows its payload.
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => list.current?.querySelectorAll('button')[1]?.click(), 50);
    return () => clearTimeout(id);
  }, []);
  return (
    <Screen h={480}>
      <div ref={list} className="flex flex-col gap-2">
        {['Q3 roadmap.key', 'Budget.numbers', 'Notes.md'].map((file) => (
          <div key={file} className="flex items-center justify-between rounded-ctl bg-card px-4 py-2.5 text-body text-foreground">
            {file}
            <PopoverTrigger controller={share} payload={{ file }} render={<Button size="sm" variant="secondary" />}>
              Share
            </PopoverTrigger>
          </div>
        ))}
      </div>
      <Popover controller={share}>
        <PopoverContent<{ file: string }> side="bottom" align="end" arrow>
          {({ payload }) => (
            <>
              <PopoverTitle>Share {payload?.file ?? 'a file'}</PopoverTitle>
              <PopoverDescription className="mt-1">Anyone with the link can view it.</PopoverDescription>
            </>
          )}
        </PopoverContent>
      </Popover>
    </Screen>
  );
}
export const SharedController: Story = { render: () => <SharedRows /> };
