/* The goals the model gets, one per scenario page (page/scenarios.tsx), and the end state each must reach. A check
   reads the page's recorded app state (`window.__state`), never the model's own account of what it did. */
export const scenarios = [
  {
    id: 'settings',
    goal: 'Turn on notifications and set the volume to 40.',
    check: (s) => s.notifications === true && s.volume === 40 && s.wifi === true,
  },
  {
    id: 'delete-project',
    goal: 'Delete the project and confirm.',
    // The bridge must have asked the person (data-agent-confirm) before the delete ran.
    check: (s) => s.deleted === true && s.confirms.length > 0,
  },
  {
    id: 'theme-color',
    goal: 'Pick the second theme color and save.',
    check: (s) => s.savedColor === 'purple',
  },
  {
    id: 'rename',
    goal: 'Rename the project to Atlas.',
    check: (s) => s.projectName === 'Atlas',
  },
  {
    id: 'repeat',
    goal: 'Make this meeting repeat every week.',
    check: (s) => s.repeat === 'week',
  },
  {
    id: 'assignee',
    goal: 'Assign the task to Lee.',
    check: (s) => s.assignee === 'lee',
  },
  {
    id: 'billing-tab',
    goal: 'In the billing section, set the company name to Northwind and save it.',
    check: (s) => s.savedCompany === 'Northwind',
  },
  {
    id: 'due-date',
    goal: 'Set the due date to September 14, 2026.',
    check: (s) => s.dueDate === '2026-09-14',
  },
  {
    id: 'archive-photo',
    goal: 'Archive this photo.',
    check: (s) => s.photoAction === 'archive',
  },
  {
    id: 'privacy',
    goal: 'Stop showing my last-seen time to others. Leave read receipts as they are.',
    check: (s) => s.showLastSeen === false && s.readReceipts === true,
  },
];
