/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import * as api from "../../src/api/index.ts";

describe("The hosting protocol package's API", () => {
  it("exports its values, and each enum valued by its names", () => {
    assert.deepEqual(Object.keys(api).toSorted(), [
      "BranchPullRequest",
      "BranchQuery",
      "CheckState",
      "DeviceCode",
      "HostAccount",
      "HostChanges",
      "HostCheck",
      "HostItem",
      "HostPerson",
      "HostReference",
      "HostSignIn",
      "HostingArgumentException",
      "HostingFieldException",
      "HostingNames",
      "HostingProtocolException",
      "PullRequestDraft",
      "ReferenceKind",
      "ReferenceState",
      "SignInFailure",
      "SignInState"
    ]);
    assert.equal("ArgumentException" in api, false);
    assert.deepEqual(api.SignInState, { SignedOut: "SignedOut", Waiting: "Waiting", SignedIn: "SignedIn" });
    assert.deepEqual(api.SignInFailure, { Expired: "Expired", Denied: "Denied", Revoked: "Revoked", Unreachable: "Unreachable", Refused: "Refused", Unkept: "Unkept", Unforgotten: "Unforgotten" });
    assert.deepEqual(api.ReferenceKind, { PullRequest: "PullRequest", Issue: "Issue" });
    assert.deepEqual(api.ReferenceState, { Open: "Open", Draft: "Draft", Merged: "Merged", Closed: "Closed", ClosedDone: "ClosedDone", ClosedNotPlanned: "ClosedNotPlanned" });
    assert.deepEqual(api.CheckState, { Queued: "Queued", Running: "Running", Succeeded: "Succeeded", Failed: "Failed", Neutral: "Neutral" });
  });
});
