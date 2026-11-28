/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DatePattern, FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException } from "@noldova/desktop.window";
import { FakeTimeFormats } from "@noldova/desktop.window/testing";
import { describe, expect, it } from "vitest";

import { GitHostFailure } from "../../../src/app/models/git-host-failure.ts";

describe("GitHostFailure", () => {
  const UNTIL: number = 1_800_003_600_000;
  const limited = new RuntimeRequestException(FailureCode.Unavailable, "GitHub's rate limit for this account is used up until 2027-01-15T09:00:00.000Z.",
    { rateLimitedUntil: UNTIL });

  it("keeps a runtime failure's words and when the host's rate limit resets, and the fallback for any other error", () => {
    const read = (failure: GitHostFailure): readonly unknown[] => [failure.message, failure.limitedUntil];

    expect([read(GitHostFailure.of(limited, "No answer.")), read(GitHostFailure.of(new RuntimeRequestException(FailureCode.Unavailable, "Down.", { rateLimitedUntil: "soon" }),
      "No answer.")), read(GitHostFailure.of(new RuntimeRequestException(FailureCode.Unavailable, "Down."), "No answer.")),
    read(GitHostFailure.of(new Error("lost"), "No answer."))]).toEqual([
      ["GitHub's rate limit for this account is used up until 2027-01-15T09:00:00.000Z.", UNTIL], ["Down.", null], ["Down.", null], ["No answer.", null]
    ]);
  });

  it("writes when the rate limit resets by the date and time format setting, and any other failure in its own words", () => {
    const formats = new FakeTimeFormats();
    const twelve: string = GitHostFailure.of(limited, "No answer.").textOf("GitHub", formats.service);
    formats.use("HH:mm", "d MMM yyyy, HH:mm");

    expect([twelve, GitHostFailure.of(limited, "No answer.").textOf("GitHub", formats.service), GitHostFailure.of(new Error("lost"), "No answer.").textOf("GitHub",
      formats.service)]).toEqual([
      `GitHub's rate limit for this account is used up until ${DatePattern.format(new Date(UNTIL), "MMM d, yyyy, h:mm a")}.`,
      `GitHub's rate limit for this account is used up until ${DatePattern.format(new Date(UNTIL), "d MMM yyyy, HH:mm")}.`, "No answer."
    ]);
  });
});
