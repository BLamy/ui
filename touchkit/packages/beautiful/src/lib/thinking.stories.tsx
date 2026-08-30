import type { Meta, StoryObj } from '@storybook/react-vite';
import { Thinking } from './thinking';
import { ThinkingDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Thinking> = {
  title: 'Organisms/Thinking',
  component: Thinking,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof Thinking>;

export const Default: Story = { render: () => <ThinkingDemo /> };
export const Collapsed: Story = {
  render: () => (
    <Thinking defaultOpen={false}>
      <Thinking.Trigger>Thinking</Thinking.Trigger>
      <Thinking.Content>
        <Thinking.Tabs>
          <Thinking.Tab id="steps">Steps</Thinking.Tab>
        </Thinking.Tabs>
        <Thinking.Panel id="steps">
          <Thinking.Step done>Pull supplier lead times</Thinking.Step>
          <Thinking.Step>Draft the reorder plan</Thinking.Step>
        </Thinking.Panel>
      </Thinking.Content>
    </Thinking>
  ),
};
export const SearchAndCode: Story = {
  render: () => (
    <Thinking defaultOpen defaultTab="search">
      <Thinking.Trigger>Researching</Thinking.Trigger>
      <Thinking.Content>
        <Thinking.Tabs>
          <Thinking.Tab id="search">Search</Thinking.Tab>
          <Thinking.Tab id="coding">Coding</Thinking.Tab>
        </Thinking.Tabs>
        <Thinking.Panel id="search">
          <Thinking.Search site="scoopdata.io">seasonal cone demand</Thinking.Search>
        </Thinking.Panel>
        <Thinking.Panel id="coding">
          <Thinking.Code>{'const risk = score(skus)'}</Thinking.Code>
        </Thinking.Panel>
      </Thinking.Content>
    </Thinking>
  ),
};
