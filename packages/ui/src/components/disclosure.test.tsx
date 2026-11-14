// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  Disclosure, DisclosureHeader, DisclosureGroup, DisclosureGroupHeader, DisclosureGroupItem, DisclosureGroupPanel, DisclosureGroupTrigger,
  DisclosurePanel, DisclosureTrigger, createAccordionController, createCollapsibleController, type DisclosureGroupProps,
} from '@/components/ui/disclosure';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const trigger = (name: string) => screen.getByRole('button', { name });

const faq = [
  ['sync', 'How does sync work?', 'In the background.'],
  ['share', 'Can I share a list?', 'Yes, from the Share menu.'],
  ['export', 'How do I export?', 'Settings, then Export Data.'],
] as const;

type Question = (typeof faq)[number][0];

function Faq(props: DisclosureGroupProps<Question>) {
  return (
    <DisclosureGroup<Question> {...props}>
      {faq.map(([value, q, a]) => (
        <DisclosureGroupItem key={value} value={value} disabled={value === 'export'}>
          <DisclosureGroupHeader><DisclosureGroupTrigger>{q}</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>{a}</DisclosureGroupPanel>
        </DisclosureGroupItem>
      ))}
    </DisclosureGroup>
  );
}

describe('Disclosure', () => {
  it('puts its trigger in a heading with DisclosureHeader, at the level you render', async () => {
    render(
      <Disclosure>
        <DisclosureHeader render={<h2 />}><DisclosureTrigger>Advanced</DisclosureTrigger></DisclosureHeader>
        <DisclosurePanel>Proxy and DNS.</DisclosurePanel>
      </Disclosure>,
    );
    await settle();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.getAttribute('data-slot')).toBe('disclosure-header');
    expect(heading.contains(trigger('Advanced'))).toBe(true);
  });

  it('a trigger opens and closes its panel, wired with aria-expanded and aria-controls', async () => {
    const onOpenChange = vi.fn();
    render(
      <Disclosure onOpenChange={onOpenChange}>
        <DisclosureTrigger>Advanced</DisclosureTrigger>
        <DisclosurePanel>Proxy and DNS.</DisclosurePanel>
      </Disclosure>,
    );
    await settle();
    const button = trigger('Advanced');
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const panel = screen.getByText('Proxy and DNS.').closest('[data-slot=collapsible-panel]')!;
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    // Closed panels stay in the page so find in page can open them.
    expect(panel.getAttribute('hidden')).toBe('until-found');
    fireEvent.click(button);
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(panel.hasAttribute('data-open')).toBe(true);
    fireEvent.click(button);
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('starts open with defaultOpen, ignores presses while disabled, and unmounts a panel that is not findable', async () => {
    render(
      <Disclosure defaultOpen disabled>
        <DisclosureTrigger>Advanced</DisclosureTrigger>
        <DisclosurePanel hiddenUntilFound={false}>Proxy and DNS.</DisclosurePanel>
      </Disclosure>,
    );
    await settle();
    const button = trigger('Advanced');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    await settle();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    cleanup();
    render(
      <Disclosure>
        <DisclosureTrigger>Advanced</DisclosureTrigger>
        <DisclosurePanel hiddenUntilFound={false}>Proxy and DNS.</DisclosurePanel>
      </Disclosure>,
    );
    await settle();
    expect(screen.queryByText('Proxy and DNS.')).toBeNull();
    expect(trigger('Advanced').hasAttribute('aria-controls')).toBe(false);
  });

  it('a controller opens it from outside, with the reason imperative', async () => {
    const controller = createCollapsibleController();
    const onOpenChange = vi.fn();
    render(
      <Disclosure controller={controller} onOpenChange={onOpenChange}>
        <DisclosureTrigger>Advanced</DisclosureTrigger>
        <DisclosurePanel>Proxy and DNS.</DisclosurePanel>
      </Disclosure>,
    );
    await settle();
    act(() => { controller.open(); });
    await settle();
    expect(controller.isOpen()).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'imperative' }));
  });
});

describe('DisclosureGroup', () => {
  it('each trigger sits in a heading and controls a region labelled by it', async () => {
    render(<Faq defaultValue={['sync']} />);
    await settle();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    const button = trigger('How does sync work?');
    expect(button.parentElement!.tagName).toBe('H3');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const region = screen.getByRole('region');
    expect(region.textContent).toBe('In the background.');
    expect(region.getAttribute('aria-labelledby')).toBe(button.id);
    expect(button.getAttribute('aria-controls')).toBe(region.id);
  });

  it('opens one item at a time, and several with multiple', async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<Faq defaultValue={['sync']} onValueChange={onValueChange} />);
    await settle();
    fireEvent.click(trigger('Can I share a list?'));
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith(['share'], expect.objectContaining({ reason: 'trigger-press' }));
    expect(trigger('How does sync work?').getAttribute('aria-expanded')).toBe('false');
    expect(trigger('Can I share a list?').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(trigger('Can I share a list?'));
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith([], expect.anything());

    rerender(<Faq multiple onValueChange={onValueChange} />);
    await settle();
    fireEvent.click(trigger('How does sync work?'));
    fireEvent.click(trigger('Can I share a list?'));
    await settle();
    expect(onValueChange).toHaveBeenLastCalledWith(['sync', 'share'], expect.anything());
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('a disabled item stays focusable and closed; closed panels are findable unless turned off', async () => {
    const { rerender } = render(<Faq />);
    await settle();
    const disabled = trigger('How do I export?');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.hasAttribute('disabled')).toBe(false);
    fireEvent.click(disabled);
    await settle();
    expect(disabled.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('In the background.').closest('[data-slot=accordion-panel]')!.getAttribute('hidden')).toBe('until-found');
    rerender(<Faq hiddenUntilFound={false} />);
    await settle();
    expect(screen.queryByText('In the background.')).toBeNull();
  });

  it('a controller opens items by value, closing the one that was open', async () => {
    const controller = createAccordionController<Question>();
    const onValueChange = vi.fn();
    render(<Faq controller={controller} defaultValue={['sync']} onValueChange={onValueChange} />);
    await settle();
    act(() => { controller.open('share'); });
    await settle();
    expect(controller.getValue()).toEqual(['share']);
    expect(onValueChange).toHaveBeenLastCalledWith(['share'], expect.objectContaining({ reason: 'imperative' }));
    expect(trigger('Can I share a list?').getAttribute('aria-expanded')).toBe('true');
    expect(trigger('How does sync work?').getAttribute('aria-expanded')).toBe('false');
  });

  it('a trigger that is not a button still answers Enter and Space', async () => {
    render(
      <DisclosureGroup>
        <DisclosureGroupItem value="a">
          <DisclosureGroupHeader><DisclosureGroupTrigger render={<span />}>Billing</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>Monthly.</DisclosureGroupPanel>
        </DisclosureGroupItem>
      </DisclosureGroup>,
    );
    await settle();
    const row = trigger('Billing');
    expect(row.tagName).toBe('SPAN');
    expect(row.tabIndex).toBe(0);
    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'Enter' });
    await settle();
    expect(row.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(row, { key: ' ' });
    await settle();
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });

  it('the inset group is UI SDK\'s Accordion, and the header takes another level with render', async () => {
    render(
      <DisclosureGroup variant="inset" defaultValue={['a']}>
        <DisclosureGroupItem value="a">
          <DisclosureGroupHeader render={<h4 />}><DisclosureGroupTrigger>Billing</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>Monthly.</DisclosureGroupPanel>
        </DisclosureGroupItem>
      </DisclosureGroup>,
    );
    await settle();
    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe('Billing');
    expect(document.querySelector('[data-slot=accordion]')!.className).toContain('rounded-panel');
    expect(screen.getByRole('region').textContent).toBe('Monthly.');
  });
});
