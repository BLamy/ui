import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'

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
      <Tabs defaultValue="overview">
        <TabsList aria-label="Project, segmented">
          <TabsTab value="overview">Overview</TabsTab>
          <TabsTab value="activity">Activity</TabsTab>
          <TabsTab value="files">Files</TabsTab>
        </TabsList>
        <TabsPanel value="overview" className="text-subhead text-muted-foreground">
          Seven open tasks, two due this week. Next review is on Thursday.
        </TabsPanel>
        <TabsPanel value="activity" className="text-subhead text-muted-foreground">
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {activity.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </TabsPanel>
        <TabsPanel value="files" className="text-subhead text-muted-foreground">
          24 files, 118 MB.
        </TabsPanel>
      </Tabs>

      <Tabs variant="underline" defaultValue="members">
        <TabsList aria-label="Workspace, underline">
          <TabsTab value="members">Members</TabsTab>
          <TabsTab value="billing">Billing</TabsTab>
          <TabsTab value="security">Security</TabsTab>
          <TabsTab value="audit" disabled>
            Audit log
          </TabsTab>
        </TabsList>
        <TabsPanel value="members" className="text-subhead text-muted-foreground">
          12 members and 3 pending invitations.
        </TabsPanel>
        <TabsPanel value="billing" className="text-subhead text-muted-foreground">
          Team plan, renews on the 1st.
        </TabsPanel>
        <TabsPanel value="security" className="text-subhead text-muted-foreground">
          Two-factor authentication is required for admins.
        </TabsPanel>
      </Tabs>
    </div>
  )
}
