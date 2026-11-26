/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SignInNotice } from "../../../src/app/models/sign-in-notice.ts";

describe("SignInNotice", () => {
  it("holds a failed sign-in's title and the hint on what to do next", () => {
    const notice = new SignInNotice("Azure DevOps didn't accept the token.", "Check that the token was copied whole and hasn't expired, then sign in again.");

    expect([notice.title, notice.hint]).toEqual(["Azure DevOps didn't accept the token.",
      "Check that the token was copied whole and hasn't expired, then sign in again."]);
  });
});
