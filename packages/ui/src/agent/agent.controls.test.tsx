// @vitest-environment happy-dom
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { entry, expectNamed, mount, run } from '../../test/agent-harness';

afterEach(cleanup);

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

type Details = { source?: string; reason?: string };
const spy = () => vi.fn<(value: any, details: Details) => void>();
const source = (fn: ReturnType<typeof spy>) => fn.mock.calls.at(-1)?.[1]?.source;

/** A settings form: one of each control, every one named the way a person would say it. */
function Settings(props: {
  onSave: () => void;
  onNotifications: (v: boolean, d: Details) => void;
  onRemember: (v: boolean | 'indeterminate', d: Details) => void;
  onPlan: (v: string | null, d: Details) => void;
  onRange: (v: string | null, d: Details) => void;
  onVolume: (v: number | number[], d: Details) => void;
  onName: (v: string, d: Details) => void;
}) {
  return (
    <div className="grid gap-4">
      <Switch aria-label="Notifications" onCheckedChange={props.onNotifications} />
      <Label variant="control"><Checkbox onCheckedChange={props.onRemember} />Remember me</Label>
      <Label variant="field" htmlFor="plan">Plan</Label>
      <RadioGroup<string> id="plan" defaultValue="free" onValueChange={props.onPlan}>
        <Label variant="control"><Radio value="free" />Free</Label>
        <Label variant="control"><Radio value="pro" />Pro</Label>
        <Label variant="control"><Radio value="team" />Team</Label>
      </RadioGroup>
      <Segmented aria-label="Time range" defaultValue="week" onValueChange={props.onRange}>
        <SegmentedItem value="day">Day</SegmentedItem>
        <SegmentedItem value="week">Week</SegmentedItem>
        <SegmentedItem value="month">Month</SegmentedItem>
      </Segmented>
      <Slider label="Volume" showValue defaultValue={20} min={0} max={100} onValueChange={props.onVolume} />
      <Field name="project">
        <FieldLabel>Project name</FieldLabel>
        <Input onValueChange={props.onName} />
      </Field>
      <Button onClick={props.onSave}>Save changes</Button>
    </div>
  );
}

describe('controls are agent-ready', () => {
  const handlers = () => ({
    onSave: vi.fn(),
    onNotifications: spy(),
    onRemember: spy(),
    onPlan: spy(),
    onRange: spy(),
    onVolume: spy(),
    onName: spy(),
  });

  it('lists every control with a name, a kind and its value', async () => {
    await mount(<Settings {...handlers()} />);
    const snapshot = agent.snapshot();
    expectNamed(snapshot, ['Notifications', 'Remember me', 'Plan', 'Time range', 'Volume', 'Project name', 'Save changes']);
    expect(entry(snapshot, 'Save changes')).toMatchObject({ component: 'button', actions: ['press'] });
    expect(entry(snapshot, 'Notifications')).toMatchObject({ component: 'switch', checked: false, actions: ['setChecked'] });
    expect(entry(snapshot, 'Remember me')).toMatchObject({ component: 'checkbox', checked: false });
    expect(entry(snapshot, 'Plan')).toMatchObject({
      component: 'radio',
      value: 'free',
      items: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }, { value: 'team', label: 'Team' }],
    });
    expect(entry(snapshot, 'Time range')).toMatchObject({ component: 'segmented-control', value: 'week' });
    expect(entry(snapshot, 'Volume')).toMatchObject({ component: 'slider', value: 20, min: 0, max: 100 });
    expect(entry(snapshot, 'Project name')).toMatchObject({ component: 'input', value: '' });
  });

  it('drives each control, and each change reports the agent as its source', async () => {
    const h = handlers();
    await mount(<Settings {...h} />);
    const result = await run(agent, [
      { ref: 'Notifications', action: 'setChecked', args: [true] },
      { ref: 'Remember me', action: 'setChecked', args: [true] },
      { ref: 'Plan', action: 'setValue', args: ['Pro'] },
      { ref: 'Time range', action: 'setValue', args: ['Month'] },
      { ref: 'Volume', action: 'setValue', args: [40] },
      { ref: 'Project name', action: 'setValue', args: ['Atlas'] },
      { ref: 'Save changes', action: 'press' },
    ]);

    expect(screen.getByRole('switch', { name: 'Notifications' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Remember me' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Pro' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Month' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('slider', { name: 'Volume' }) as HTMLInputElement).value).toBe('40');
    expect((screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement).value).toBe('Atlas');
    expect(h.onSave).toHaveBeenCalledTimes(1);

    expect(h.onNotifications).toHaveBeenLastCalledWith(true, expect.anything());
    expect(h.onRemember).toHaveBeenLastCalledWith(true, expect.anything());
    expect(h.onPlan).toHaveBeenLastCalledWith('pro', expect.anything());
    expect(h.onRange).toHaveBeenLastCalledWith('month', expect.anything());
    expect(h.onVolume).toHaveBeenLastCalledWith(40, expect.anything());
    expect(h.onName).toHaveBeenLastCalledWith('Atlas', expect.anything());
    for (const fn of [h.onNotifications, h.onRemember, h.onPlan, h.onRange, h.onVolume, h.onName]) expect(source(fn)).toBe('agent');

    // The result reads back what took effect.
    const values = Object.entries(result.values as Record<string, unknown>);
    expect(values.find(([key]) => key.endsWith(' Volume'))?.[1]).toBe(40);
    expect(values.find(([key]) => key.endsWith(' Project name'))?.[1]).toBe('Atlas');
  });

  it('refuses a choice that is not one of the items', async () => {
    await mount(<Settings {...handlers()} />);
    const result = await agent.act({ steps: [{ ref: 'Plan', action: 'setValue', args: ['Platinum'] }] });
    expect(result.ok).toBe(false);
    expect(screen.getByRole('radio', { name: 'Free' }).getAttribute('aria-checked')).toBe('true');
  });

  it('keeps a value the app cancels', async () => {
    await mount(<Switch aria-label="Locked setting" onCheckedChange={(_, details) => details.cancel()} />);
    await agent.act({ steps: [{ ref: 'Locked setting', action: 'setChecked', args: [true] }] });
    expect(screen.getByRole('switch', { name: 'Locked setting' }).getAttribute('aria-checked')).toBe('false');
  });

  // Models often repeat the button's text as press's argument; the bridge then looks only for buttons inside it.
  it.fails('presses a Button given its own text', async () => {
    const onClick = vi.fn();
    await mount(<Button onClick={onClick}>Save theme</Button>);
    await run(agent, [{ ref: 'Save theme', action: 'press', args: ['Save theme'] }]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not offer a disabled control', async () => {
    await mount(<Switch aria-label="Managed by admin" disabled />);
    expect(entry(agent.snapshot(), 'Managed by admin')).toMatchObject({ disabled: true, actions: [] });
  });
});
