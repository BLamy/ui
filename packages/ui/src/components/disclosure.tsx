'use client';
import type { ComponentProps, ReactNode } from 'react';
import {
  Accordion as SdkAccordion,
  AccordionHeader as SdkAccordionHeader,
  AccordionItem as SdkAccordionItem,
  AccordionPanel as SdkAccordionPanel,
  AccordionTrigger as SdkAccordionTrigger,
} from '@ui-sdk/react/accordion';
import {
  Collapsible as SdkCollapsible,
  CollapsiblePanel as SdkCollapsiblePanel,
  CollapsibleTrigger as SdkCollapsibleTrigger,
} from '@ui-sdk/react/collapsible';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cx } from '@/lib/utils';

/* ══ Disclosure / DisclosureGroup — UI SDK's Collapsible and Accordion in the kit's look ══
   One section that shows and hides is a Disclosure (Collapsible); a set that shares its open items is a
   DisclosureGroup (Accordion: one open at a time unless `multiple`, each trigger inside a heading). UI SDK owns
   the button and region wiring, Enter and Space, `open` / `onOpenChange(open, details)` and `value` /
   `onValueChange(value, details)`. The panel springs its height open from the size UI SDK measures while its
   content fades down into place, the chevron turns rather than swapping, and closed panels stay findable
   (`hiddenUntilFound`), so the browser's find in page opens the section that holds a match.
   <Disclosure><DisclosureTrigger>Title</DisclosureTrigger><DisclosurePanel>…</DisclosurePanel></Disclosure>
   <DisclosureGroup>
     <DisclosureGroupItem value="a">
       <DisclosureGroupHeader><DisclosureGroupTrigger>Title</DisclosureGroupTrigger></DisclosureGroupHeader>
       <DisclosureGroupPanel>…</DisclosureGroupPanel>
     </DisclosureGroupItem>
   </DisclosureGroup> ══ */
export { createAccordionController } from '@ui-sdk/react/accordion';
export { createCollapsibleController } from '@ui-sdk/react/collapsible';

export const disclosureGroupVariants = cva('flex flex-col', {
  variants: {
    variant: {
      /** Rows separated by hairlines, no container. */
      default: '',
      /** iOS inset-grouped card. */
      inset: 'overflow-hidden rounded-panel bg-card px-4',
    },
  },
  defaultVariants: { variant: 'default' },
});

/* The look both families share: a row, its trigger, and a panel that animates open and closed. */
const item = 'group/disclosure relative text-foreground not-last:shadow-hairline-b';
const trigger =
  'bl-btn box-border flex min-h-11 flex-1 cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-0 py-[11px] text-left [font-family:inherit] text-body leading-[22px] font-normal text-foreground outline-none rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/45 active:not-data-disabled:opacity-60 data-disabled:cursor-default data-disabled:opacity-40';
const panel =
  'group/disclosure-panel overflow-clip text-subhead leading-[20px] text-muted-foreground transition-[height] duration-spring-tray ease-spring-tray data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none';

function Chevron() {
  return (
    <Icon
      name="chev"
      size={17}
      sw={2.4}
      className="shrink-0 text-tertiary-foreground transition-transform duration-spring-snappy ease-spring-snappy group-data-open/disclosure:rotate-90 motion-reduce:transition-none"
    />
  );
}

/** A panel's content, in the padded wrapper that fades down into place on the tray spring and out on the quick
    exit curve. It starts each opening at the faded style without animating there first. */
function content<State>(children: ReactNode | ((state: State) => ReactNode)) {
  const wrap = (kids: ReactNode) => (
    <div className="pb-3.5 transition-[opacity,translate] duration-spring-tray ease-spring-tray group-data-starting-style/disclosure-panel:-translate-y-1 group-data-starting-style/disclosure-panel:opacity-0 group-data-starting-style/disclosure-panel:transition-none group-data-ending-style/disclosure-panel:-translate-y-1 group-data-ending-style/disclosure-panel:opacity-0 group-data-ending-style/disclosure-panel:duration-exit group-data-ending-style/disclosure-panel:ease-exit motion-reduce:transition-none">
      {kids}
    </div>
  );
  return typeof children === 'function' ? (state: State) => wrap(children(state)) : wrap(children);
}

/** A trigger's label with the chevron after it. */
function label<State>(children: ReactNode | ((state: State) => ReactNode)) {
  return typeof children === 'function' ? (state: State) => <>{children(state)}<Chevron /></> : <>{children}<Chevron /></>;
}

/* ── Disclosure: one section ── */
export type DisclosureProps = ComponentProps<typeof SdkCollapsible>;

export function Disclosure({ className, ...props }: DisclosureProps) {
  return <SdkCollapsible className={cx(item, className)} {...props} />;
}

export type DisclosureTriggerProps = ComponentProps<typeof SdkCollapsibleTrigger>;

/** The row that opens and closes the panel, as wide as the disclosure. Wrap it in a heading where the section
    belongs in the page's outline. */
export function DisclosureTrigger({ className, children, ...props }: DisclosureTriggerProps) {
  return (
    <SdkCollapsibleTrigger className={cx([trigger, 'w-full'], className)} {...props}>
      {label(children)}
    </SdkCollapsibleTrigger>
  );
}

export type DisclosurePanelProps = ComponentProps<typeof SdkCollapsiblePanel>;

export function DisclosurePanel({ className, children, hiddenUntilFound = true, ...props }: DisclosurePanelProps) {
  return (
    <SdkCollapsiblePanel hiddenUntilFound={hiddenUntilFound} className={cx([panel, 'h-(--collapsible-panel-height)'], className)} {...props}>
      {content(children)}
    </SdkCollapsiblePanel>
  );
}

/* ── DisclosureGroup: an accordion ── */
export type DisclosureGroupProps<T extends string = string> = Parameters<typeof SdkAccordion<T>>[0] &
  VariantProps<typeof disclosureGroupVariants>;

export function DisclosureGroup<T extends string = string>({ className, variant, hiddenUntilFound = true, ...props }: DisclosureGroupProps<T>) {
  return (
    <SdkAccordion<T>
      hiddenUntilFound={hiddenUntilFound}
      className={cx(disclosureGroupVariants({ variant }), className)}
      {...props}
    />
  );
}

export type DisclosureGroupItemProps = ComponentProps<typeof SdkAccordionItem>;

export function DisclosureGroupItem({ className, ...props }: DisclosureGroupItemProps) {
  return <SdkAccordionItem className={cx(item, className)} {...props} />;
}

export type DisclosureGroupHeaderProps = ComponentProps<typeof SdkAccordionHeader>;

/** The heading around an item's trigger: an `h3`, or the level you `render` (`render={<h4 />}`). */
export function DisclosureGroupHeader({ className, ...props }: DisclosureGroupHeaderProps) {
  return <SdkAccordionHeader className={cx('m-0 flex', className)} {...props} />;
}

export type DisclosureGroupTriggerProps = ComponentProps<typeof SdkAccordionTrigger>;

export function DisclosureGroupTrigger({ className, children, ...props }: DisclosureGroupTriggerProps) {
  return (
    <SdkAccordionTrigger className={cx(trigger, className)} {...props}>
      {label(children)}
    </SdkAccordionTrigger>
  );
}

export type DisclosureGroupPanelProps = ComponentProps<typeof SdkAccordionPanel>;

export function DisclosureGroupPanel({ className, children, ...props }: DisclosureGroupPanelProps) {
  return (
    <SdkAccordionPanel className={cx([panel, 'h-(--accordion-panel-height)'], className)} {...props}>
      {content(children)}
    </SdkAccordionPanel>
  );
}
