import { useState } from 'react'
import { List, ListRow, ListSection, NavigationStack, type Screen } from '@brett_lamy/ui'

type Project = { name: string; journeys: string[]; runs: string[] }

const PROJECTS: Project[] = [
  { name: 'Checkout redesign', journeys: ['Browse to checkout', 'Guest purchase'], runs: ['Passed · 12 min ago', 'Failed · yesterday'] },
  { name: 'Account recovery', journeys: ['Forgot password', 'MFA recovery'], runs: ['Passed · 2 hours ago', 'Passed · Monday'] },
  { name: 'Mobile onboarding', journeys: ['First session', 'Permission prompt'], runs: ['Running · now', 'Passed · 3 days ago'] },
]

function Rows({ title, rows, onSelect }: { title: string; rows: string[]; onSelect: (row: string) => void }) {
  return (
    <List inset>
      <ListSection title={title}>
        {rows.map((row, i) => (
          <ListRow key={row} title={row} accessory="chevron" divider={i < rows.length - 1} onPress={() => onSelect(row)} />
        ))}
      </ListSection>
    </List>
  )
}

function ProjectsDemo() {
  // The path is the stack: project → journey → run.
  const [project, setProject] = useState<Project>()
  const [journey, setJourney] = useState<string>()
  const [run, setRun] = useState<string>()
  const screens: Screen[] = [
    {
      key: 'projects',
      title: 'Projects',
      largeTitle: true,
      grouped: true,
      content: <Rows title="Projects" rows={PROJECTS.map((p) => p.name)} onSelect={(name) => setProject(PROJECTS.find((p) => p.name === name))} />,
    },
  ]
  if (project)
    screens.push({ key: 'journeys', title: project.name, grouped: true, content: <Rows title="Journeys" rows={project.journeys} onSelect={setJourney} /> })
  if (project && journey)
    screens.push({ key: 'runs', title: journey, grouped: true, content: <Rows title="Test runs" rows={project.runs} onSelect={setRun} /> })
  if (project && journey && run)
    screens.push({
      key: 'run',
      title: 'Test run',
      grouped: true,
      content: (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>TEST RUN</div>
          <h3 style={{ margin: '6px 0 8px' }}>{run}</h3>
          <p style={{ margin: 0, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            Assertions, traces, screenshots, and timing details for this run appear here.
          </p>
        </div>
      ),
    })
  const onPop = () => {
    if (run) setRun(undefined)
    else if (journey) setJourney(undefined)
    else setProject(undefined)
  }
  return <NavigationStack screens={screens} onPop={onPop} />
}

export default function ProjectsExample() {
  return (
    <div
      style={{
        maxWidth: 620,
        margin: '0 auto',
        height: 520,
        borderRadius: 18,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border)',
        isolation: 'isolate',
      }}
    >
      <ProjectsDemo />
    </div>
  )
}
