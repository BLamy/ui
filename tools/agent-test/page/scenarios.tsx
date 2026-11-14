/* The model-driven scenarios: small pages built from the kit the way an app would build them (names a person would
   use, state through change callbacks, a `data-agent-confirm` on the one destructive press). Each records the state
   its goal is about in `store`, which run.mjs checks after the model stops. Goals and checks live in
   ../scenarios.mjs. */
import { useState, type ComponentType } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Combobox, ComboboxContent, ComboboxField, ComboboxInput, ComboboxTrigger } from '@/components/ui/combobox';
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { DisclosureGroup, DisclosureGroupHeader, DisclosureGroupItem, DisclosureGroupPanel, DisclosureGroupTrigger } from '@/components/ui/disclosure';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';

/** What the scenarios did, for run.mjs's checks. `confirms` holds every `data-agent-confirm` the bridge asked about. */
export const store: Record<string, unknown> & { confirms: string[] } = { confirms: [] };
const record = (key: string, value: unknown) => {
  store[key] = value;
};

/** useState that also records its value. */
function useRecorded<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    record(key, initial);
    return initial;
  });
  return [value, (next: T) => { record(key, next); setValue(next); }] as const;
}

function Row({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-card bg-card px-4 py-3">
      <div className="grid gap-0.5">
        <span id={id} className="text-body">{title}</span>
        {hint ? <span className="text-footnote text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Settings() {
  const [wifi, setWifi] = useRecorded('wifi', true);
  const [notifications, setNotifications] = useRecorded('notifications', false);
  const [volume, setVolume] = useRecorded('volume', 20);
  return (
    <>
      <h1 className="text-title">Sound & alerts</h1>
      <Row id="wifi" title="Wi-Fi sync" hint="Only sync over Wi-Fi">
        <Switch aria-labelledby="wifi" checked={wifi} onCheckedChange={setWifi} />
      </Row>
      <Row id="notify" title="Notifications" hint="Banners and sounds">
        <Switch aria-labelledby="notify" checked={notifications} onCheckedChange={setNotifications} />
      </Row>
      <Slider label="Volume" showValue min={0} max={100} value={volume} onValueChange={(v) => setVolume(Array.isArray(v) ? v[0] : v)} />
    </>
  );
}

function DeleteProject() {
  const [deleted, setDeleted] = useRecorded('deleted', false);
  return (
    <>
      <h1 className="text-title">Project “Aurora”</h1>
      <p className="m-0 text-subhead text-muted-foreground">{deleted ? 'The project was deleted.' : '24 files · 3 members'}</p>
      <AlertDialog onOpenChange={(open, details) => { if (!open && details.returnValue === 'delete') setDeleted(true); }}>
        <AlertDialogTrigger className={`${buttonVariants({ variant: 'destructive' })} justify-self-start`}>Delete project</AlertDialogTrigger>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “Aurora”?</AlertDialogTitle>
            <AlertDialogDescription>Its 24 files are removed for everyone. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
            <AlertDialogClose variant="destructive" value="delete" data-agent-confirm="Deletes the project Aurora and its 24 files">Delete forever</AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ThemeColor() {
  const [color, setColor] = useState<string | null>('blue');
  const [, setSaved] = useRecorded<string | null>('savedColor', null);
  return (
    <>
      <h1 className="text-title">Appearance</h1>
      <Label variant="field" htmlFor="theme-color">Theme color</Label>
      <RadioGroup<string> id="theme-color" value={color} onValueChange={setColor}>
        <Label variant="control"><Radio value="blue" />Blue</Label>
        <Label variant="control"><Radio value="purple" />Purple</Label>
        <Label variant="control"><Radio value="orange" />Orange</Label>
      </RadioGroup>
      <Button className="justify-self-start" onClick={() => setSaved(color)}>Save theme</Button>
    </>
  );
}

function Rename() {
  const [name, setName] = useRecorded('projectName', 'Aurora');
  const [draft, setDraft] = useState(name);
  return (
    <>
      <h1 className="text-title">Project: {name}</h1>
      <Dialog onOpenChange={(open) => open && setDraft(name)}>
        <DialogTrigger className={`${buttonVariants({ variant: 'secondary' })} justify-self-start`}>Rename…</DialogTrigger>
        <DialogBackdrop />
        <DialogContent>
          <DialogClose />
          <DialogHeader><DialogTitle>Rename project</DialogTitle></DialogHeader>
          <DialogBody>
            <Field>
              <FieldLabel>New name</FieldLabel>
              <Input value={draft} onValueChange={setDraft} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <DialogClose render={<Button />} value="save" action={() => setName(draft.trim())}>Save name</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const repeats = [
  { value: 'never', label: 'Never' },
  { value: 'day', label: 'Every day' },
  { value: 'week', label: 'Every week' },
  { value: 'month', label: 'Every month' },
];

function Repeat() {
  const [repeat, setRepeat] = useRecorded<string | null>('repeat', 'never');
  return (
    <>
      <h1 className="text-title">Team sync · Tuesday 10:00</h1>
      <Field>
        <FieldLabel>Repeat</FieldLabel>
        <Select items={repeats} value={repeat} onValueChange={setRepeat}>
          <SelectTrigger />
          <SelectContent />
        </Select>
      </Field>
    </>
  );
}

const people = [
  { value: 'ana', label: 'Ana Torres' },
  { value: 'kim', label: 'Kim Park' },
  { value: 'lee', label: 'Lee Chen' },
  { value: 'maya', label: 'Maya Okafor' },
];

function Assignee() {
  const [assignee, setAssignee] = useRecorded<string | null>('assignee', 'kim');
  return (
    <>
      <h1 className="text-title">Fix the login redirect</h1>
      <Field>
        <FieldLabel>Assignee</FieldLabel>
        <Combobox items={people} value={assignee} onValueChange={setAssignee}>
          <ComboboxField>
            <ComboboxInput placeholder="Search the team" />
            <ComboboxTrigger />
          </ComboboxField>
          <ComboboxContent />
        </Combobox>
      </Field>
    </>
  );
}

function BillingTab() {
  const [tab, setTab] = useState<string | null>('profile');
  const [company, setCompany] = useState('');
  const [, setSaved] = useRecorded<string | null>('savedCompany', null);
  return (
    <>
      <h1 className="text-title">Account</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Account sections">
          <TabsTab value="profile">Profile</TabsTab>
          <TabsTab value="billing">Billing</TabsTab>
        </TabsList>
        <TabsPanel value="profile" className="grid gap-3 pt-4">
          <Field>
            <FieldLabel>Display name</FieldLabel>
            <Input defaultValue="Brett" />
          </Field>
        </TabsPanel>
        <TabsPanel value="billing" className="grid gap-3 pt-4">
          <Field>
            <FieldLabel>Company name</FieldLabel>
            <Input value={company} onValueChange={setCompany} />
          </Field>
          <Button className="justify-self-start" onClick={() => setSaved(company)}>Save billing details</Button>
        </TabsPanel>
      </Tabs>
    </>
  );
}

function DueDate() {
  const [date, setDate] = useRecorded<string | null>('dueDate', null);
  return (
    <>
      <h1 className="text-title">Quarterly report</h1>
      <Field>
        <FieldLabel>Due date</FieldLabel>
        <DatePicker locale="en-US" defaultMonth="2026-09" value={date} onValueChange={setDate}>
          <DatePickerField />
          <DatePickerContent />
        </DatePicker>
      </Field>
    </>
  );
}

function ArchivePhoto() {
  const [, setLast] = useRecorded<string | null>('photoAction', null);
  return (
    <>
      <h1 className="text-title">IMG_0412.heic</h1>
      <DropdownMenu onAction={(value) => setLast(value)}>
        <DropdownMenuTrigger className={`${buttonVariants({ variant: 'secondary' })} justify-self-start`} aria-label="Photo actions">•••</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem value="copy">Copy</DropdownMenuItem>
          <DropdownMenuItem value="share">Share…</DropdownMenuItem>
          <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
          <DropdownMenuItem value="delete" destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function Privacy() {
  const [open, setOpen] = useState<string[]>([]);
  const [lastSeen, setLastSeen] = useRecorded('showLastSeen', true);
  const [readReceipts, setReadReceipts] = useRecorded('readReceipts', true);
  return (
    <>
      <h1 className="text-title">Settings</h1>
      <DisclosureGroup aria-label="Settings sections" variant="inset" multiple value={open} onValueChange={setOpen}>
        <DisclosureGroupItem value="notifications">
          <DisclosureGroupHeader><DisclosureGroupTrigger>Notifications</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel>Mentions and direct messages always notify.</DisclosureGroupPanel>
        </DisclosureGroupItem>
        <DisclosureGroupItem value="privacy">
          <DisclosureGroupHeader><DisclosureGroupTrigger>Privacy</DisclosureGroupTrigger></DisclosureGroupHeader>
          <DisclosureGroupPanel className="grid gap-2">
            <Row id="last-seen" title="Show last seen"><Switch aria-labelledby="last-seen" checked={lastSeen} onCheckedChange={setLastSeen} /></Row>
            <Row id="receipts" title="Read receipts"><Switch aria-labelledby="receipts" checked={readReceipts} onCheckedChange={setReadReceipts} /></Row>
          </DisclosureGroupPanel>
        </DisclosureGroupItem>
      </DisclosureGroup>
    </>
  );
}

export const scenarios: Record<string, ComponentType> = {
  settings: Settings,
  'delete-project': DeleteProject,
  'theme-color': ThemeColor,
  rename: Rename,
  repeat: Repeat,
  assignee: Assignee,
  'billing-tab': BillingTab,
  'due-date': DueDate,
  'archive-photo': ArchivePhoto,
  privacy: Privacy,
};
