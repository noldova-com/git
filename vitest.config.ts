/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 160_000,
    hookTimeout: 160_000,
    include: [
      "src/*/tests/**/*.test.ts"
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.ts"
      ],
      exclude: [
        "**/tests/**",
        "src/*.window/**"
      ],
      reporter: [
        "text",
        "json-summary"
      ],
      reportsDirectory: "_build/coverage",
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
