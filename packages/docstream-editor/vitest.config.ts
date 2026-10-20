import { defineConfig } from "vitest/config"

// The package's own suite (tests pick their DOM with `// @vitest-environment`); without this file vitest
// would climb to the workspace's config, which lists projects instead of tests.
export default defineConfig({ test: {} })
