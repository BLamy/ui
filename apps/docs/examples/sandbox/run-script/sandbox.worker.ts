import { serveSandbox } from '@/lib/sandbox/worker'

// The whole Worker. Your bundler builds this file with the runtime
// (@agent-wasm/core) in it; the page never loads the runtime.
serveSandbox()
