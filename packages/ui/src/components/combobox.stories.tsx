import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Combobox, ComboboxChips, ComboboxClear, ComboboxContent, ComboboxEmpty, ComboboxInputGroup, ComboboxGroup, ComboboxGroupLabel, ComboboxInput,
  ComboboxItem, ComboboxList, ComboboxStatus, ComboboxTrigger,
} from '@/components/ui/combobox';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
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

function City({ query, open, presentation }: { query?: string; open?: boolean; presentation?: 'popover' | 'sheet' | 'auto' }) {
  const ref = useTypeOnMount(query);
  return (
    <Field ref={ref}>
      <FieldLabel>City</FieldLabel>
      <Combobox defaultOpen={open && !query} presentation={presentation}>
        <ComboboxInputGroup>
          <ComboboxInput placeholder="Search cities" />
          <ComboboxTrigger />
        </ComboboxInputGroup>
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
/** As a bottom sheet (`presentation="sheet"`, or `"auto"` in a compact scope): the grabber, the input in the sheet's
    header, and 44px rows in body text. */
export const Sheet: Story = { render: () => <Screen h={560}><City open presentation="sheet" /></Screen> };
export const SheetDark: Story = { render: () => <Screen dark h={560}><City open presentation="sheet" /></Screen> };

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
          <ComboboxInputGroup>
            <ComboboxInput placeholder="Search the team" />
            <ComboboxTrigger />
          </ComboboxInputGroup>
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

function Cities({ dark, open }: { dark?: boolean; open?: boolean }) {
  return (
    <Screen dark={dark} h={520}>
      <Field>
        <FieldLabel>Cities</FieldLabel>
        <Combobox multiple defaultValue={['Lisbon', 'Seoul', 'Tokyo']} defaultOpen={open}>
          <ComboboxInputGroup>
            <ComboboxChips><ComboboxInput placeholder="Add a city" /></ComboboxChips>
            <ComboboxClear />
            <ComboboxTrigger />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>No cities found.</ComboboxEmpty>
            <ComboboxList>{cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}</ComboboxList>
          </ComboboxContent>
        </Combobox>
        <FieldDescription>Backspace removes the last; the arrow keys move between chips.</FieldDescription>
      </Field>
    </Screen>
  );
}

/** `multiple`, with the choice as chips and a Clear button. */
export const Multiple: Story = { render: () => <Cities open /> };
export const MultipleDark: Story = { render: () => <Cities dark open /> };

export const Groups: Story = {
  render: () => (
    <Screen h={520}>
      <Field>
        <FieldLabel>City</FieldLabel>
        <Combobox defaultOpen>
          <ComboboxInputGroup />
          <ComboboxContent>
            <ComboboxList>
              <ComboboxGroup>
                <ComboboxGroupLabel>Europe</ComboboxGroupLabel>
                {['Amsterdam', 'Berlin', 'Lisbon'].map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}
              </ComboboxGroup>
              <ComboboxGroup>
                <ComboboxGroupLabel>Asia</ComboboxGroupLabel>
                {['Seoul', 'Tokyo'].map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}
              </ComboboxGroup>
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Field>
    </Screen>
  ),
};

/** An async list's status line, while results load. */
export const AsyncStatus: Story = {
  render: () => (
    <Screen h={320}>
      <Field>
        <FieldLabel>Movie</FieldLabel>
        <Combobox items={[]} status="loading" filter={false} defaultOpen>
          <ComboboxInputGroup />
          <ComboboxContent>
            <ComboboxStatus>{(state) => (state.loading ? 'Searching…' : null)}</ComboboxStatus>
            <ComboboxList />
          </ComboboxContent>
        </Combobox>
      </Field>
    </Screen>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Screen h={300}>
      <Field invalid>
        <FieldLabel>City</FieldLabel>
        <Combobox items={cities}>
          <ComboboxInputGroup />
          <ComboboxContent />
        </Combobox>
        <FieldError match>Pick a city we fly to.</FieldError>
      </Field>
    </Screen>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Screen h={300}>
      <Field disabled>
        <FieldLabel>City</FieldLabel>
        <Combobox items={cities} defaultValue="Lisbon">
          <ComboboxInputGroup />
          <ComboboxContent />
        </Combobox>
      </Field>
    </Screen>
  ),
};

/** The field in its three sizes: 32, 44 and 50px. */
export const Sizes: Story = {
  render: () => (
    <Screen h={360}>
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <Combobox key={size} items={cities} defaultValue="Paris">
          <ComboboxInputGroup size={size}>
            <ComboboxInput aria-label={`City, ${size}`} />
            <ComboboxTrigger />
          </ComboboxInputGroup>
          <ComboboxContent />
        </Combobox>
      ))}
    </Screen>
  ),
};
