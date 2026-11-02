# GitHub clone: feature matrix and backlog

The durable record of what this example does, how each claim was verified, and what's left. Update it with every milestone.
It isn't part of the registry item (not in `meta.json`'s files).

## How to read the status

| Status | Meaning |
| --- | --- |
| **E2E** | Exercised by clicks and keys in `tools/e2e/github-clone.e2e.mjs` against the in-page GitHub (`sample-server.ts`), and the write read back |
| **Unit** | Covered through the real client in `sample-server.test.ts` or `github-api.test.ts`, not driven through the UI by the suite |
| **Built** | Implemented and type-checked, not yet exercised by an automated test |
| **Partial** | Works with a stated gap |
| **External** | Blocked by GitHub's API or account limits; the UI says so rather than pretending |
| **Backlog** | Not implemented |

**What no status here means:** none of it has been run against real GitHub with writes. The sample server copies GitHub's documented
JSON and rules, but it's our model of GitHub, written by the same author as the client, so agreement between them is weak evidence.
See "Live verification" below for what has actually touched github.com.

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
| Line links | Built | Single lines; no ranges |
| Image files, binary and too-large notices | Built | |
| Raw, download, copy path, permalink | Built | Permalink currently uses the ref, not the sha: **Backlog** |
| Go to file (`t`) | E2E | Fuzzy; prefers matches in the file name |
| Commit history by ref, path, author, with pages | E2E / Unit | |
| Commit page: message, parents, PRs, checks, diff | E2E | |
| Create, edit, delete a file; direct or new branch and PR | E2E | Fork-to-edit offered without write access. Upload: **Backlog** |
| Branches page: new, rename, delete, ahead/behind, its PR | E2E / Built | Rename is Built |
| Tags page, delete, archives | Built | |
| Releases: list, detail, draft, publish, edit, delete, generated notes | E2E / Unit | Asset upload: **External** (uploads.github.com doesn't allow browsers) |
| Clone dialog, Download ZIP, GitHub Desktop | Built | Hidden in the sample, which isn't on GitHub |
| Empty repository | E2E | |
| Truncated trees (huge repositories) | **Backlog** | Files past the cut read as "isn't on this branch" |
| Submodules and symlinks | **Backlog** | Treated as files |

## Issues

| Workflow | Status | Notes |
| --- | --- | --- |
| List through GitHub's search syntax, query box is the truth | E2E | |
| Author, labels, milestone, assignee, sort menus; no:label, no:assignee | E2E / Built | |
| Pages to the end (search caps at 1000 results) | E2E | The cap is GitHub's: **External** |
| Create: title, body, Write/Preview, labels, assignees, milestone | E2E | People without triage are told labels etc. aren't theirs to set |
| Issue templates | Built | Markdown templates only. YAML issue forms: **Backlog** |
| Edit title and body | E2E | |
| Comment; Enter is a new line, ⌘↵ posts; text survives failure | E2E | |
| Edit, delete, quote comments; copy link | E2E / Built | Quote and delete are Built |
| Reactions on issues and comments | Unit | Not driven by e2e |
| Close completed / not planned, close with comment, reopen; counts move | E2E | |
| Labels, assignees, milestone from the sidebar, with timeline events | E2E | |
| Lock, unlock, pin, subscribe, delete | Unit | Not driven by e2e |
| Labels page, milestones page and detail | E2E / Built | Milestone detail is Built |
| `#12`, `owner/repo#3`, `@user`, sha autolinks | E2E | |
| Number that's a PR moves to its page | E2E | |
| Attachments | **External** | GitHub has no upload API; the composer doesn't offer them |
| @mention and #reference autocomplete | **Backlog** | |
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
| Threads: reply, resolve, outdated | E2E / Unit | |
| Self-review blocked | Unit | |
| Suggested changes, expand diff context | **Backlog** | |
| Compare and create PR, draft, template, fork heads | E2E / Unit | Fork heads list the fork's default branch only |

## Actions

| Workflow | Status | Notes |
| --- | --- | --- |
| Runs with event, status, branch, actor, workflow filters and pages | E2E / Unit | |
| Run: jobs, steps, re-run all or failed, cancel, delete | E2E / Unit | |
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
| Roles: read, triage, write, admin; archived, locked, signed out | E2E | Maintain is treated like write |
| Failures in place: 401, 403, 404, 409, 422, rate limit | E2E / Unit | |
| Fresh data: writes refresh every screen; focus revalidates; short cache | E2E / Built | Focus revalidation is Built |
| URLs: deep links, reload, browser back with `syncUrl` | E2E | Default off, so it doesn't fight a host page's routing |
| Phone: every workflow reachable, 44px targets | Partial | E2E covers issue, PR, code, filters, Actions. **No full audit yet** |
| Keyboard and screen reader | Partial | Focus rings, landmarks and status text added. **axe not re-run** |
| Dark mode | Partial | Stories exist; new screens not reviewed in dark |

## Live verification

| Check | Status |
| --- | --- |
| Reads against real github.com | **Not done** |
| GraphQL queries validated against GitHub's real schema | **Not done** |
| Any write against real GitHub | **Not done, and not authorized without a suitable test target** |

## Backlog, in priority order

1. Whatever the PM's next review finds.
2. Validate every query and read mapping against real GitHub, read-only.
3. Truncated trees, submodules, symlinks.
4. Drive what's only Unit or Built through the UI: reactions, lock, pin, delete, rename branch, squash and rebase.
5. Phone and accessibility audit, axe, dark mode review.
6. Permalink by sha, line ranges, file upload, suggested changes, expand context, autocomplete, YAML issue forms.

## Known problems outside this block

- `node tools/tokens/check.mjs` fails on `registry/blocks/macos/open-code.tsx` (3 color literals). Not touched by this work.

## History

- **PM baseline:** read-only viewer, about 60 inert controls, the only write a comment, sample data contradicting itself.
- **Milestone 1:** the rewrite above. 25 e2e workflows and 53 unit tests. The e2e run found real bugs: single-select pickers ignoring
  clicks, Escape not closing pickers, loads stuck on their first empty answer, same-repository links going nowhere.
