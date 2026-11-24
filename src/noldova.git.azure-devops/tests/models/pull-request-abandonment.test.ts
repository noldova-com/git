/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException } from "@noldova/context.json";
import { HostReference } from "@noldova/git.hosting.protocol";
import { describe, it } from "vitest";

import { PullRequestAbandonment } from "../../src/models/pull-request-abandonment.ts";

const reference: HostReference = new HostReference("git-azure-devops", "fabrikam", "3411ebc1-d5aa-464f-9615-0b527bc66719", 482);
const commit: string = "9f2c4e1a7b3d5f6081c2e4a6b8d0f1e3a5c7b9d1";

describe("PullRequestAbandonment", () => {
  it("reads the pull request and the commit the page showed", () => {
    assert.deepEqual(PullRequestAbandonment.fromJson({ reference: reference.toJson(), sourceCommit: commit }), new PullRequestAbandonment(reference, commit));
  });

  it("answers null for another host's or organization's reference or a commit that isn't a whole id", () => {
    const values = [new HostReference("git-github", "octocat", "hello-world", 482), new HostReference("git-azure-devops", "fab_rikam", reference.repository, 482)]
      .map(t => ({ reference: t.toJson(), sourceCommit: commit }))
      .concat([commit.slice(0, 39), commit.toUpperCase(), `${commit}0`].map(t => ({ reference: reference.toJson(), sourceCommit: t })));

    assert.deepEqual(values.map(t => PullRequestAbandonment.fromJson(t)), values.map(() => null));
  });

  it("refuses a payload without a reference or a commit", () => {
    for (const value of [null, { sourceCommit: commit }, { reference: reference.toJson(), sourceCommit: 7 }])
      assert.throws(() => PullRequestAbandonment.fromJson(value), JsonException);
  });
});
