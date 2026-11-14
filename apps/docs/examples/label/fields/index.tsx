import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// A Label names a control by `htmlFor` (the control's `id`) or by wrapping it:
// pressing the label focuses, checks or toggles the control, and screen
// readers announce it as the name. `variant="control"` is the line around a
// checkbox, radio or switch, which dims with it when it is disabled.
export default function Fields() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <div className="grid gap-1.5">
        <Label variant="field" htmlFor="label-display-name">Display name</Label>
        <Input id="label-display-name" defaultValue="Brett Lamy" />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="label-default">The default variant, 15px</Label>
        <Input id="label-default" defaultValue="Default variant" />
      </div>

      <div className="grid gap-3">
        <Label variant="control"><Checkbox defaultChecked />Remember me on this device</Label>
        <Label variant="control"><Switch defaultChecked />Sync over Wi-Fi only</Label>
        <Label variant="control"><Checkbox disabled />Disabled, dimmed with its control</Label>
      </div>
    </div>
  )
}
