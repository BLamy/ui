# GitHub clone: feature matrix and backlog

The durable record of what this example does, how each claim was verified, and what's left. Update it with every milestone.
It isn't part of the registry item (not in `meta.json`'s files).

## How to read the status

| Status | Meaning |
| --- | --- |
| **E2E** | Exercised by clicks and keys in `tools/e2e/github-clone.e2e.mjs` against the in-page GitHub (`sample-server.ts`), and the write read back |
| **E2E (read back)** | Same, and the test asks the server what was actually written. The stronger claim |
| **Unit** | Covered through the real client in `sample-server.test.ts` or `github-api.test.ts`, not driven through the UI by the suite |
| **Built** | Implemented and type-checked, not yet exercised by an automated test |
| **Partial** | Works with a stated gap |
| **External** | Blocked by GitHub's API or account limits; the UI says so rather than pretending |
| **Backlog** | Not implemented |

**Compound statuses** such as "E2E / Built" mean the main path is E2E and the Notes name the part that isn't.

**The limit of all of this:** no write has ever been sent to real GitHub. Writes run against `sample-server.ts`, our model of GitHub, written by the same
author as the client, so agreement between those two is weak evidence. Reads and queries *have* been checked against github.com: see "Live verification".

## Repository and account

| Workflow | Status | Notes |
| --- | --- | --- |
| Pick by owner/name or github.com URL (URL also opens its screen) | E2E | Rejects non-GitHub URLs |
| Search all of GitHub for repositories | E2E | |
| Your repositories, your stars | Built | Stars tab not driven by e2e |
| Opens on your last or most recently pushed repository, not a hardcoded one | Built | Live path only |
| Account menu, sign out, rate limit and token scopes | Built | |
| Star / unstar, stargazers | E2E / Built | Stargazers list is Built |
| Watch: participating, all, ignore; watchers | E2E / Built | |
| Fork (name, owner, default branch only); forks list | E2E / Built | |
| New repository | Unit (fake) / Built | Not driven by e2e |
| Your issues, your pull requests, notifications, mark read | E2E | |
| Global search (`/`): files, issues, PRs, code | E2E | Live code search needs a signed-in token and indexes the default branch only |

## Code

| Workflow | Status | Notes |
| --- | --- | --- |
| File table with each entry's last commit | E2E | One GraphQL query per folder |
| Branch and tag switcher, filter, create a branch, stays on the path | E2E | |
| Tree, blob, README with relative links and images, folder READMEs | E2E / Built | Relative images in private repositories won't load: raw URLs need auth |
| Markdown preview, code, blame | E2E | Blame comes from GraphQL |
| Line links and ranges (shift-click) | Built | |
| Image files, binary and too-large notices | Built | |
| Raw, download, copy path, permalink by commit | Built | Copy reports its real result. Raw in the sample shows its own bytes |
| Go to file (`t`) | E2E | Fuzzy; prefers matches in the file name |
| Commit history by ref, path, author, with pages | E2E / Unit | |
| Commit page: message, parents, PRs, checks, diff | E2E | |
| Commit comments | E2E (read back) / Unit | Whole-commit only; line comments on commits are **Backlog** |
| Create, edit, delete a file; direct or new branch and PR | E2E | Upload: **Backlog** |
| Edit and delete never overwrite a version you didn't see | E2E (read back) | The version is pinned when you start; GitHub's 409 becomes a conflict screen and keeps your text |
| Writes go to the file, issue or PR they were typed on | E2E (read back) | Screens keyed by route, drafts by document |
| Rename or move a file while editing | E2E (read back) | One commit, through the Git Data API, after a version check. **Git Data writes unverified live** |
| Upload files, several in one commit | E2E (read back) | 25 MB per file here. **Unverified live** |
| Tags and commits take no commits; no-change commits are off; a missing file says so | E2E | |
| Without write access: fork, edit there, open the PR back | E2E | Real forks take a moment to appear: **unverified live** |
| Contribute button on a fork | Built | |
| Branches page: new, rename, delete, ahead/behind, its PR | E2E / Built | Rename is Built |
| Tags page, create, delete, archives | E2E (read back) / Built | Create is e2e-driven; the sample hides archives |
| Releases: list, detail, draft, publish, edit, delete, generated notes | E2E / Unit | Asset upload: **External** (uploads.github.com doesn't allow browsers) |
| Clone dialog, Download ZIP, GitHub Desktop | Built | Hidden in the sample, which isn't on GitHub |
| Empty repository | E2E | |
| Truncated trees (huge repositories) | Unit (live) / Built | Says so; paths past the cut are asked for directly. The sample has none, so the screen isn't e2e-driven |
| Submodules and symlinks | Unit (live) / Built | The sample has none, so the screens aren't e2e-driven |

## Issues

| Workflow | Status | Notes |
| --- | --- | --- |
| List through GitHub's search syntax, query box is the truth | E2E | |
| Author, labels, milestone, assignee, sort menus; no:label, no:assignee | E2E / Built | |
| Pages to the end (search caps at 1000 results) | E2E | The cap is GitHub's: **External** |
| Create: title, body, Write/Preview, labels, assignees, milestone | E2E | People without triage are told labels etc. aren't theirs to set |
| Issue templates | E2E | Markdown and YAML |
| Edit title and body | E2E | |
| Comment; Enter is a new line, ⌘↵ posts; text survives failure | E2E | |
| Edit, delete, quote comments; copy link | E2E / Built | Quote and delete are Built |
| Reactions on issues and comments | Unit | Not driven by e2e |
| Close completed / not planned, close with comment, reopen; counts move | E2E | |
| Labels, assignees, milestone from the sidebar, with timeline events | E2E | |
| Development: pull requests that close this issue | E2E | |
| Lock, unlock, pin, subscribe, delete | Unit | Not driven by e2e |
| Labels page, milestones page and detail | E2E / Built | Milestone detail is Built |
| `#12`, `owner/repo#3`, `@user`, sha autolinks | E2E | |
| Number that's a PR moves to its page | E2E | |
| Attachments | **External** | GitHub has no upload API; the composer doesn't offer them |
| @mention and #reference autocomplete | E2E | Enter is a new line until you arrow to a choice; none inside code |
| Task lists write back; read-only without permission; off when they can't be mapped to source | E2E (read back) / Unit | |
| Bulk actions on issues and PRs: state, labels, assignees, milestone | E2E (read back) / Built | Labels add, as on GitHub. PR bulk is Built. One write each; stops at a refusal and says how far it got |
| Issue forms (YAML) | E2E | As a Markdown skeleton: the API creates issues from text, so fields become headings. Required-field checks aren't enforced |
| Drafts survive leaving: comments, edit comment, reply, line comment, review, new issue, new file, new PR, file edit, commit message, release | E2E / Built | Comment, edit comment, line comment and file edit are e2e-driven. Held in memory for the page's life; leaving the page warns. Titles and Settings fields don't persist |
| Cancel asks when there's something to lose, and never leaves the block | E2E | |
| Transfer issue, issue types, sub-issues, Projects | **Backlog** / External | Projects needs a `project` scope the sign-in doesn't request, so the filter was removed |

## Pull requests

| Workflow | Status | Notes |
| --- | --- | --- |
| List with real check and review state, filters, pages, Merged | E2E / Unit | |
| Each PR shows its own commits, files and conversation | Unit | |
| Edit title, body, base branch | E2E / Built | Base change is Built |
| Close, reopen, draft and ready | E2E | |
| Reviewers, assignees, labels, milestone | E2E / Built | |
| Dismiss a review | Unit | |
| Development: issues it closes | Unit | |
| Merge box reasons: conflicts, draft, blocked, behind, no permission | E2E | |
| Merge, squash, rebase, allowed methods only, editable message | E2E / Unit | Squash and rebase through the UI: Built |
| Update branch; delete and restore branch | E2E | |
| Auto-merge | Unit | Merge queue: **Backlog** |
| Mergeability and check polling while unsettled | Built | Live only; can't happen in the sample |
| Commits tab, per-commit diff, Checks tab | E2E / Built | |
| Files: unified, split, filter, viewed | E2E | Hide whitespace: **External** (REST has no such parameter) |
| Line comments, ranges, pending review, submit, discard | E2E / Unit | Ranges are Built |
| Threads: reply, resolve, outdated | E2E | Outdated comes from the comment's own commit |
| Self-review blocked | Unit | |
| Suggest a change, commit a suggestion | E2E (read back) | Refuses if the lines aren't what was reviewed. Via the Contents API: GitHub has no suggestion endpoint. One at a time: batching is **Backlog** |
| Expand diff context | E2E | Whole file at once, not hunk by hunk. Expanded lines take no comments: they aren't in the diff |
| Revert a merged PR; re-request review | E2E / Unit | A second revert reports the existing branch but doesn't link to its PR |
| Metadata on Create PR | E2E (read back) | If the extras are refused, the PR still opens and says so |
| Compare and create PR, draft, template, tags, fork heads | E2E / Unit | Your fork's branches by name; other forks' default branch only |

## Actions

| Workflow | Status | Notes |
| --- | --- | --- |
| Runs with event, status, branch, actor, workflow filters and pages | E2E / Unit | |
| Run: jobs, steps, re-run all, failed or one job, cancel, delete | E2E (read back) / Unit | |
| Artifacts: list | E2E | Download links to GitHub: its archive URLs need the token and redirect to storage a browser can't follow with it |
| Job logs | Partial | Sample works. Live redirects to storage that may refuse browsers: **unverified**, and the UI falls back to a GitHub link |
| Dispatch with inputs from the workflow file | E2E / Unit | Simple YAML reader, not a full parser |
| Enable, disable, new workflow | E2E / Built | Pushing to `.github/workflows` needs the `workflow` scope the sign-in doesn't request: **External**, untested live |

## Insights and Settings

| Workflow | Status | Notes |
| --- | --- | --- |
| Pulse, contributors, commit activity, code frequency, forks | E2E / Unit | Charts have tables |
| Traffic, for people who can push | E2E / Unit | |
| Settings: name, description, website, topics, features, default branch | E2E / Built | Admins only |
| Merge rules, visibility, archive | E2E / Built | |
| Branch protection | Partial | Read only. Editing stays on GitHub |
| Collaborators | Built | |
| Delete repository | **External** | Needs `delete_repo`; links to GitHub |

## Platform

| Concern | Status | Notes |
| --- | --- | --- |
| Roles: read, triage, write, admin; archived, signed out | E2E | Maintain is treated like write |
| Locked conversations | Unit | Not driven by e2e |
| Failures in place: 403 (REST and GraphQL), 404, 409, rate limit on load | E2E | Name the action, dismissable |
| 401 in the UI; rate limit mid-session; 422 per write type | Unit | Not driven by e2e |
| Failed refresh keeps the screen and what you typed | E2E | |
| A screen's render error stays in that screen | Built | |
| Fresh data: writes refresh every screen; short cache | E2E | Focus revalidation is Built |
| URLs: deep links, reload, browser back, across repository switches, with `syncUrl` | E2E | Default off, so it doesn't fight a host page's routing |
| Focus moves to the heading on navigation; announced | E2E | |
| Phone: every workflow reachable, 44px targets | Partial | E2E covers issue, PR, code, filters, Actions. **No full audit yet** |
| Keyboard and screen reader | Partial | Focus rings, landmarks and status text added. **axe not re-run** |
| Dark mode | Partial | Stories exist; new screens not reviewed in dark |

## Live verification

`GITHUB_LIVE=1 pnpm exec vitest run --config packages/ui/vitest.config.mts registry/blocks/github-clone/github-api.live`. Goes through the `gh` CLI, so the code
never holds a token, and its fetch refuses anything but GET and GraphQL queries.

| Check | Status |
| --- | --- |
| Every read mapper against real github.com | **Passes** on `cli/cli` (busy) and `BLamy/ui` (quiet), 12 of 12 each |
| GraphQL queries against GitHub's real schema | **Passes**: they ran for real |
| Truncated trees | **Passes** on `torvalds/linux`, including asking for paths past the cut |
| Submodules and symlinks | **Passes** on `git/git` (mapping only; the screens are Built) |
| Mutation input names against GitHub's schema | **Passes** by introspection. Names only: **none has been executed** |
| REST writes | **Not done** |
| Any write against real GitHub | **Not done. Needs a sandbox repository the owner names** |
| Real sign-in through the Passwords keychain in a browser | **Not done** |
| Job logs through a browser (CORS on the redirect) | **Not done**: `gh` doesn't show CORS |

Findings from it so far: `stats/code_frequency` answers 422 above 10,000 commits, which the screen reports in GitHub's words.

## Backlog, in priority order

1. Whatever the PM's next review finds.
2. A write pass on a sandbox repository, once the owner names one. **External: needs a decision.**
3. Drive what's only Unit or Built through the UI: reactions, lock, delete issue, rename branch, squash and rebase in the UI, PR bulk.
4. Phone: the shared NavigationStack back button is 36px high; line numbers and inline text links are small by the inline exception; line ranges in the code view have no touch path.
5. Conflict editor (links to GitHub today), suggestion batching, line comments on commits, a second revert linking its PR.

## Out of scope, on purpose

This example doesn't present these, and they aren't in the core workflows asked for: Discussions, Wiki, Projects, Security tabs; profile pages and a dashboard;
webhooks, deploy keys, secrets, environments and rulesets in Settings; editing branch protection (it's read here, with a link). Settings' feature toggles say so.

## History

- **PM baseline:** read-only viewer, about 60 inert controls, the only write a comment, sample data contradicting itself.
- **PM round 1 (on milestone 1):** drafts lost, silent overwrite on edit, a failed refresh destroying the screen, back broken across repositories,
  about 10 overstated matrix rows.
- **PM round 2 (on milestone 2):** comments, titles and file edits landing on the wrong target when navigating between same-kind screens; Commit suggestion overwriting
  whatever had moved to that line; drafts surviving new-branch commits. The e2e suite missed all three because it checked controls, not what was written.
- **Milestone 3:** those, the rest of that review's P1s, and every non-blocked gap it listed. 54 e2e workflows with read-backs, 67 unit tests, 12 live checks.
- **Milestone 2:** all of those, plus the contribution path and parity features. 37 e2e workflows, 53 unit tests, 12 read-only checks against github.com on two repositories.
- **Milestone 1:** the rewrite above. 25 e2e workflows and 53 unit tests. The e2e run found real bugs: single-select pickers ignoring
  clicks, Escape not closing pickers, loads stuck on their first empty answer, same-repository links going nowhere.
