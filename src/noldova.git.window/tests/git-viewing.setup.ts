/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach } from "vitest";

import { GitViewing } from "../src/app/services/git-viewing.ts";
import { GitFixtures } from "./fixtures/git-fixtures.fixture.ts";

afterEach(() => {
  GitViewing.branch.set(null);
  GitViewing.showChanges(GitFixtures.folder);
});
