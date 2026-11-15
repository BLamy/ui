// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProgressStepperItem, ProgressStepperItemDescription, ProgressStepperItemIcon, ProgressStepperItemLabel, ProgressStepper, ProgressStepperItemTrack } from '@/components/ui/progress-stepper';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const steps = [
  { id: 'a', label: 'Ordered' },
  { id: 'b', label: 'Shipped' },
  { id: 'c', label: 'Delivered' },
];

describe('ProgressStepper', () => {
  it('is a list named "Progress" by default, with the current step marked', () => {
    render(<ProgressStepper steps={steps} current={1} />);
    const list = screen.getByRole('list', { name: 'Progress' });
    const items = Array.from(list.querySelectorAll('li'));
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['complete', 'current', 'upcoming']);
    expect(items[1].getAttribute('aria-current')).toBe('step');
  });

  it('takes its own name, or a label element, so two steppers on a page differ', () => {
    render(
      <>
        <ProgressStepper steps={steps} current={0} aria-label="Order" />
        <h2 id="deploy">Deploy</h2>
        <ProgressStepper steps={steps} current={2} aria-labelledby="deploy" data-testid="deploy" />
      </>,
    );
    expect(screen.getByRole('list', { name: 'Order' })).toBeTruthy();
    const deploy = screen.getByRole('list', { name: 'Deploy' });
    expect(deploy.hasAttribute('aria-label')).toBe(false);
    expect(deploy.getAttribute('data-testid')).toBe('deploy');
  });

  it('says which steps are completed, and marks them with a check', () => {
    render(<ProgressStepper steps={steps.map((s) => ({ ...s, icon: <i /> }))} current={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toBe('Ordered, completed');
    expect(items[2].textContent).toBe('Delivered');
    expect(items[0].querySelector('[data-slot="progress-stepper-item-check"]')).not.toBeNull();
    expect(items[2].querySelector('[data-slot="progress-stepper-item-check"]')).toBeNull();
  });

  it('marks every step complete when current is the step count', () => {
    render(<ProgressStepper steps={steps} current={3} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['complete', 'complete', 'complete']);
    expect(items.some((li) => li.hasAttribute('aria-current'))).toBe(false);
  });

  it('builds each segment on the Progress rail', () => {
    const { container } = render(<ProgressStepper steps={steps} current={1} />);
    const track = container.querySelector('[data-slot="progress-stepper-item-track"]')!;
    expect(track.className).toContain('rounded-full');
    expect(track.className).toContain('h-1');
  });

  it('takes parts: a description, a class and a marker of its own per step', () => {
    render(
      <ProgressStepper current={1} labels aria-label="Order">
        <ProgressStepperItem label="Placed" description="12:04" className="placed" />
        <ProgressStepperItem data-testid="custom">
          <ProgressStepperItemIcon><b data-testid="marker" /></ProgressStepperItemIcon>
          <ProgressStepperItemTrack />
          <ProgressStepperItemLabel>Preparing</ProgressStepperItemLabel>
          <ProgressStepperItemDescription>About 8 min</ProgressStepperItemDescription>
        </ProgressStepperItem>
        <ProgressStepperItem label="Ready" />
      </ProgressStepper>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['complete', 'current', 'upcoming']);
    expect(items[0].className).toContain('placed');
    expect(items[0].querySelector('[data-slot="progress-stepper-item-description"]')!.textContent).toBe('12:04');
    expect(screen.getByTestId('custom').getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('marker')).toBeTruthy();
    expect(items[1].querySelector('[data-slot="progress-stepper-item-label"]')!.className).not.toContain('sr-only');
  });

  it('keeps labels for screen readers only unless asked to show them', () => {
    const { container } = render(<ProgressStepper steps={steps} current={0} />);
    expect(container.querySelector('[data-slot="progress-stepper-item-label"]')!.className).toContain('sr-only');
  });

  it('reads a complete step with the `completedLabel` it is given', () => {
    render(<ProgressStepper steps={steps} current={1} completedLabel="terminé" />);
    expect(screen.getAllByRole('listitem')[0].textContent).toContain(', terminé');
  });

  it('puts a line\'s labels on a second row under the icon, wrapping to two lines', () => {
    const { container } = render(<ProgressStepper steps={steps} current={1} variant="line" labels />);
    expect(container.querySelector('[data-slot="progress-stepper-item"]')!.className).toContain('grid-cols-[auto_minmax(0,1fr)]');
    const label = container.querySelector('[data-slot="progress-stepper-item-label"]')!;
    expect(label.className).toContain('line-clamp-2');
    expect(label.className).toContain('col-span-2');
    expect(label.className).not.toContain('truncate');
  });
});
