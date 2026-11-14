// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProgressStepper } from '@/components/ui/progress-stepper';

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
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual(['done', 'active', 'todo']);
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
});
