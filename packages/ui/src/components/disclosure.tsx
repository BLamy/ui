import type { ReactNode } from 'react';
import {
  Button,
  Disclosure as AriaDisclosure, type DisclosureProps as AriaDisclosureProps,
  DisclosureGroup as AriaDisclosureGroup, type DisclosureGroupProps as AriaDisclosureGroupProps,
  DisclosurePanel as AriaDisclosurePanel, type DisclosurePanelProps as AriaDisclosurePanelProps,
  Heading,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '../lib/icon';
import { cn } from '../lib/utils';

/* ══ Disclosure / Accordion — react-aria's Disclosure, DisclosureGroup and DisclosurePanel (button + region
   wiring, Enter/Space, `hidden="until-found"` so find-in-page opens panels). The panel animates its height
   from react-aria's --disclosure-panel-height.
   <Accordion>
     <AccordionItem id="a"><AccordionTrigger>Title</AccordionTrigger><AccordionContent>…</AccordionContent></AccordionItem>
   </Accordion> ══ */

export const disclosureGroupVariants = cva('flex flex-col', {
  variants: {
    variant: {
      /** Rows separated by hairlines, no container. */
      default: '',
      /** iOS inset-grouped card. */
      inset: 'overflow-hidden rounded-[12px] bg-card px-4',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface DisclosureGroupProps extends AriaDisclosureGroupProps, VariantProps<typeof disclosureGroupVariants> {}

export function DisclosureGroup({ className, variant, ...props }: DisclosureGroupProps) {
  return (
    <AriaDisclosureGroup
      data-slot="disclosure-group"
      className={composeRenderProps(className, (cls) => cn(disclosureGroupVariants({ variant }), cls))}
      {...props}
    />
  );
}

export function Disclosure({ className, ...props }: AriaDisclosureProps) {
  return (
    <AriaDisclosure
      data-slot="disclosure"
      className={composeRenderProps(className, (cls) =>
        cn('group/disclosure relative text-foreground not-last:shadow-[inset_0_-1px_0_var(--bl-sep)]', cls))}
      {...props}
    />
  );
}

export interface DisclosureTriggerProps {
  children?: ReactNode;
  className?: string;
  /** Heading level for the trigger's wrapper (default 3). */
  level?: number;
}

export function DisclosureTrigger({ className, children, level = 3 }: DisclosureTriggerProps) {
  return (
    <Heading level={level} className="m-0 flex">
      <Button
        slot="trigger"
        data-slot="disclosure-trigger"
        className={composeRenderProps(className, (cls) => cn(
          'bl-btn box-border flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-0 py-[11px] text-left [font-family:inherit] text-[17px] leading-[22px] font-normal text-foreground outline-none',
          'rounded-md data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-pressed:opacity-60 data-disabled:cursor-default data-disabled:opacity-40',
          cls,
        ))}
      >
        {children}
        <Icon
          name="chev"
          size={17}
          sw={2.4}
          className="shrink-0 text-bl-label3 transition-transform duration-300 ease-ios group-data-expanded/disclosure:rotate-90"
        />
      </Button>
    </Heading>
  );
}

export function DisclosurePanel({ className, children, ...props }: AriaDisclosurePanelProps) {
  return (
    <AriaDisclosurePanel
      data-slot="disclosure-panel"
      className={composeRenderProps(className, (cls) => cn(
        'h-(--disclosure-panel-height) overflow-clip text-[15px] leading-[20px] text-muted-foreground transition-[height] duration-300 ease-ios motion-reduce:transition-none',
        cls,
      ))}
      {...props}
    >
      <div className="pb-3.5">{children}</div>
    </AriaDisclosurePanel>
  );
}

/* shadcn's Accordion names. */
export const Accordion = DisclosureGroup;
export const AccordionItem = Disclosure;
export const AccordionTrigger = DisclosureTrigger;
export const AccordionContent = DisclosurePanel;
