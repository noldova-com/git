/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { GitPullRequestsState } from "../../../src/app/enums/git-pull-requests-state.ts";
import { GitHostTally } from "../../../src/app/models/git-host-tally.ts";

describe("GitHostTally", () => {
  it("gathers each remote and read state once", () => {
    const tally: GitHostTally = new GitHostTally();
    tally.add("a", GitPullRequestsState.Ready);
    tally.add("b", null);
    tally.add("a", GitPullRequestsState.Ready);

    expect([[...tally.remotes], [...tally.states]]).toEqual([["a", "b"], [GitPullRequestsState.Ready, null]]);
  });
});
