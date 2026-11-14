import { defineConfig } from "vitest/config"

// UI SDK's development checks (and `__UI_SDK_STRICT__`) sit behind the package's "development"
// export condition, so the packages are run through Vite with that condition instead of Node's resolver.
export default defineConfig({
  resolve: { conditions: ["development", "module", "browser", "import", "default"] },
  ssr: { resolve: { conditions: ["development", "module", "node", "import", "default"] } },
  test: {
    setupFiles: ["./test/setup.ts"],
    server: { deps: { inline: [/@ui-sdk\//] } },
  },
})
