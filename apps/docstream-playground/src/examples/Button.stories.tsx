import { Button } from "./Button"

export default {
  component: Button,
  args: { label: "Storybook file on disk" },
}

export const Primary = {
  args: { label: "Primary story export" },
}

/** No `args` of its own: the meta's default `args` apply. */
export const Default = {}

/** A story with its own `render`, receiving the merged args as props. */
export const Toolbar = {
  args: { label: "Save" },
  render: ({ label }: { label?: string }) => (
    <div style={{ display: "flex", gap: 8 }}>
      <Button label={label} />
      <Button label="Cancel" />
    </div>
  ),
}
