/* The data Worktree Atlas shows and the source that provides it. A source is anything that can list a machine's
   Git worktrees, list and read a worktree's files, diff one against main and delete some: the in-memory demo (data.ts), folders opened in the
   browser (browser-source.ts), or a desktop app's IPC bridge. The UI only talks to this interface. */

export type ChangeStatus = 'added' | 'modified' | 'deleted';

export interface PullRequest {
  number: number;
  state: 'open' | 'merged' | 'closed';
  url: string;
}

export interface Worktree {
  id: string;
  projectId: string;
  /** The folder's name. */
  name: string;
  /** Absolute path when the source knows it, else the path under the opened folder. */
  path: string;
  /** Checked-out branch; null for a detached HEAD. */
  branch: string | null;
  /** Short commit id of HEAD. */
  head: string;
  /** The repository's own checkout. Git won't remove it, and neither will Atlas. */
  primary: boolean;
  /** Another full clone of the same project (its own `.git`, same origin). Deleting it removes the whole folder,
      history included, so unpushed branches are checked first. */
  clone?: boolean;
  /** `git worktree lock`ed: Git refuses to remove it. */
  locked?: boolean;
  /** Its folder is gone; deleting only prunes Git's record of it. */
  missing?: boolean;
  /** The source can't open this folder (it is outside every opened location): listed, not diffable. */
  unreachable?: boolean;
  /** Folder modified time, ms. */
  modified?: number;
  /** Checkout size on disk, bytes. */
  size?: number;
  pullRequest?: PullRequest;
}

export interface Project {
  id: string;
  name: string;
  /** Where the repository lives (absolute, or under the opened folder). */
  path: string;
  /** The branch diffs are taken against (`main`, else `master`). */
  baseBranch: string;
  worktrees: Worktree[];
  /** The origin remote, when there is one: clones with the same origin are one project. */
  remote?: string;
  /** Shared `.git` size, bytes. */
  gitSize?: number;
  /** Why some of it couldn't be read. */
  note?: string;
}

export interface DiffFile {
  path: string;
  status: ChangeStatus;
  /** Contents at the merge base (absent when added). */
  before?: string;
  /** Contents in the worktree, including uncommitted edits (absent when deleted). */
  after?: string;
  /** Not shown as text: binary, or too large. */
  skipped?: 'binary' | 'large';
}

export interface WorktreeDiff {
  baseBranch: string;
  /** Short id of the merge base the diff starts from. */
  base: string;
  /** Commits on the worktree's HEAD since the merge base, and on the base branch since then (capped). */
  ahead: number;
  behind: number;
  /** Uncommitted changes against the worktree's own HEAD. */
  dirty: boolean;
  files: DiffFile[];
}

/** A file in a worktree's checkout: tracked, or untracked and not ignored. */
export interface FileEntry {
  path: string;
  /** Uncommitted change against the worktree's HEAD. */
  status?: ChangeStatus;
}

export interface FileContent {
  /** Absent when skipped. */
  text?: string;
  skipped?: 'binary' | 'large';
}

export interface WorktreeStatus {
  /** Uncommitted or untracked files that deleting the folder would lose. */
  dirty: boolean;
  changed: number;
  /** For a clone: local branches (and `stash`) with commits that no remote branch has. Deleting loses them. */
  unpushed?: string[];
}

export interface RemoveResult {
  id: string;
  ok: boolean;
  error?: string;
}

export interface ScanProgress {
  /** What is being read now: a folder path. */
  at: string;
  found: number;
}

export interface WorktreeSource {
  /** A short name for where the data comes from ("Sample data", "This browser"). */
  label: string;
  /** Re-reads every location. */
  scan(onProgress?: (p: ScanProgress) => void): Promise<Project[]>;
  diff(worktree: Worktree, signal?: AbortSignal): Promise<WorktreeDiff>;
  status(worktree: Worktree): Promise<WorktreeStatus>;
  /** Every file in the checkout, for browsing. */
  files(worktree: Worktree, signal?: AbortSignal): Promise<FileEntry[]>;
  /** One file's contents as it is in the checkout. */
  read(worktree: Worktree, path: string): Promise<FileContent>;
  /** `force` deletes worktrees with uncommitted changes (`git worktree remove --force`). */
  remove(worktrees: Worktree[], options: { force: boolean }): Promise<RemoveResult[]>;
  /** The opened locations, when the source has them (the browser source does). */
  locations?(): Location[];
  /** Ask for another location (opens a folder picker). Resolves false when the user cancelled. */
  addLocation?(): Promise<boolean>;
  removeLocation?(id: string): Promise<void>;
  /** Locations remembered from an earlier visit that need a press to grant access again. */
  reconnect?(id: string): Promise<boolean>;
}

export interface Location {
  id: string;
  name: string;
  connected: boolean;
}
