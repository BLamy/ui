/* The sample repository: sample-server.ts's small GitHub behind the same client real GitHub uses, one per page so what
   you do in the demo survives moving between screens (and stays in this page: nothing goes anywhere). */
import { createGitHub, githubRepo, type GitHub } from './github-api';
import { createSampleServer, type SampleServer, type ServerOptions } from './sample-server';
import { sampleSeed, type SampleSeedOptions } from './sample-seed';
import type { RepoSource } from './source';

export const SAMPLE_REPO = 'acme/orbit';
export const SAMPLE_TOKEN = 'sample-token-not-a-secret';

export interface SampleOptions extends SampleSeedOptions, Pick<ServerOptions, 'latency' | 'viewer' | 'scopes'> {}

/** A fresh sample GitHub and the client for it: tests and stories make their own. */
export function createSampleGitHub({ role, ...options }: SampleOptions = {}): { gh: GitHub; server: SampleServer } {
  const server = createSampleServer({ seed: () => sampleSeed({ role }), ...options });
  const gh = createGitHub({ token: SAMPLE_TOKEN, fetch: server.fetch, now: server.now, settle: 0, ttl: 5 * 60_000 });
  return { gh, server };
}

let shared: GitHub | null = null;
/** The page's sample GitHub. */
export function sampleGitHub(): GitHub {
  return (shared ??= createSampleGitHub().gh);
}

/** A repository in the page's sample GitHub. */
export const sampleSource = (full = SAMPLE_REPO, gh = sampleGitHub()): RepoSource => githubRepo(gh, full, { live: false });
