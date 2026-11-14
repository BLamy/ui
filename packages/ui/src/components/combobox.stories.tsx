import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof Combobox> = {
  title: 'Molecules/Combobox',
  component: Combobox,
};
export default meta;
type Story = StoryObj<typeof Combobox>;

const cities = ['Amsterdam', 'Barcelona', 'Berlin', 'Copenhagen', 'Lisbon', 'London', 'Madrid', 'Paris', 'Prague', 'San Francisco', 'Seoul', 'Tokyo'];

/* Types `text` into the input once mounted, as a person would: UI SDK filters on what is typed (a starting
   `defaultQuery` is only the input's text), so a filtered story types its query. */
function useTypeOnMount(text: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = ref.current?.querySelector<HTMLInputElement>('input');
    if (!text || !input) return;
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, [text]);
  return ref;
}

function City({ query, open }: { query?: string; open?: boolean }) {
  const ref = useTypeOnMount(query);
  return (
    <Field ref={ref}>
      <FieldLabel>City</FieldLabel>
      <Combobox defaultOpen={open && !query}>
        <ComboboxInput placeholder="Search cities" />
        <ComboboxContent>
          <ComboboxEmpty>No cities found.</ComboboxEmpty>
          <ComboboxList>
            {cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription>Type to filter; arrow keys to move.</FieldDescription>
    </Field>
  );
}

export const Open: Story = { render: () => <Screen h={560}><City open /></Screen> };
export const Filtered: Story = { render: () => <Screen h={420}><City open query="B" /></Screen> };
export const Empty: Story = { render: () => <Screen h={320}><City open query="zz" /></Screen> };
export const Closed: Story = { render: () => <Screen h={300}><City /></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={560}><City open /></Screen> };

const people = [
  { value: 'ana', label: 'Ana Torres', keywords: ['ana@northwind.dev'] },
  { value: 'kim', label: 'Kim Park', keywords: ['kim@northwind.dev'] },
  { value: 'lee', label: 'Lee Chen', keywords: ['lee@northwind.dev'] },
];

/** Options as data, drawn by hand from the list's state so each row gets an icon and a description. */
export const FromData: Story = {
  render: () => (
    <Screen h={480}>
      <Field>
        <FieldLabel>Assignee</FieldLabel>
        <Combobox defaultOpen defaultValue="kim" items={people}>
          <ComboboxInput placeholder="Search the team" />
          <ComboboxContent>
            <ComboboxEmpty>No one matches.</ComboboxEmpty>
            <ComboboxList>
              {(state) => (state.items as typeof people).map((p) => (
                <ComboboxItem key={p.value} value={p.value} label={p.label} keywords={p.keywords} description={p.keywords[0]} icon={<Icon name="person" size={22} />}>
                  {p.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
    </Screen>
  ),
};
