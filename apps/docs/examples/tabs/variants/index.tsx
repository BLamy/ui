import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs'

const activity = [
  'Maya approved the Q3 roadmap',
  'Jonas left a comment on Onboarding v2',
  'Priya merged 3 pull requests',
]

// `segmented` (the default) is the iOS control: a tinted track with a card
// that slides under the selected tab. `underline` is a bar under the labels,
// with a tint line that slides and resizes. Both share the same parts.
export default function Variants() {
  return (
    <div className="mx-auto grid max-w-lg gap-8">
      <Tabs defaultSelectedKey="overview">
        <TabList aria-label="Project, segmented">
          <Tab id="overview">Overview</Tab>
          <Tab id="activity">Activity</Tab>
          <Tab id="files">Files</Tab>
        </TabList>
        <TabPanel id="overview" className="text-subhead text-muted-foreground">
          Seven open tasks, two due this week. Next review is on Thursday.
        </TabPanel>
        <TabPanel id="activity" className="text-subhead text-muted-foreground">
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {activity.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </TabPanel>
        <TabPanel id="files" className="text-subhead text-muted-foreground">
          24 files, 118 MB.
        </TabPanel>
      </Tabs>

      <Tabs variant="underline" defaultSelectedKey="members">
        <TabList aria-label="Workspace, underline">
          <Tab id="members">Members</Tab>
          <Tab id="billing">Billing</Tab>
          <Tab id="security">Security</Tab>
          <Tab id="audit" isDisabled>
            Audit log
          </Tab>
        </TabList>
        <TabPanel id="members" className="text-subhead text-muted-foreground">
          12 members and 3 pending invitations.
        </TabPanel>
        <TabPanel id="billing" className="text-subhead text-muted-foreground">
          Team plan, renews on the 1st.
        </TabPanel>
        <TabPanel id="security" className="text-subhead text-muted-foreground">
          Two-factor authentication is required for admins.
        </TabPanel>
      </Tabs>
    </div>
  )
}
