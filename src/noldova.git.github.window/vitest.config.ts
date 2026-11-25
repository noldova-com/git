/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { ClassMetadataCoverage } from "../../scripts/angular/class-metadata-coverage.ts";

const cacheDir = fileURLToPath(new URL("../../node_modules/.vite", import.meta.url));
// A machine whose system reserves Vitest's browser port, as Windows can, names another in NOLDOVA_TEST_PORT; others keep Vitest's.
const port: string | undefined = process.env["NOLDOVA_TEST_PORT"];

export default defineConfig({
  plugins: [new ClassMetadataCoverage(), { name: "noldova:cache-dir", config: { order: "pre", handler: () => ({ cacheDir }) } }],
  optimizeDeps: {
    include: ["@noldova/context.core", "@noldova/context.exceptions", "@noldova/context.json"]
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))]
    }
  },
  test: {
    ...(port === undefined ? {} : { api: { port: Number(port) } }),
    attachmentsDir: fileURLToPath(new URL("../../_build/github-window/attachments", import.meta.url)),
    coverage: {
      reportsDirectory: fileURLToPath(new URL("../../_build/github-window-coverage", import.meta.url))
    }
  }
});
