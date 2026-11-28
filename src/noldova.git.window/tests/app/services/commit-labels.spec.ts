/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";
import { TimeFormatService } from "@noldova/desktop.window";
import { afterEach, describe, expect, it } from "vitest";

import { CommitLabels } from "../../../src/app/services/commit-labels.ts";
import { Resources } from "../../../src/resources.ts";
import { TimeFormatsFixture } from "../../fixtures/time-formats.fixture.ts";

describe("CommitLabels", () => {
  const now: Date = new Date(2026, 10, 20, 15, 0, 0);
  const at = (days: number, hours: number, minutes: number, seconds = 0): string =>
    new Date(2026, 10, 20 - days, 15 - hours, -minutes, -seconds).toISOString();
  const ageOf = (iso: string): string => CommitLabels.ageOf(iso, now, TestBed.inject(TimeFormatService));

  afterEach(() => TimeFormatsFixture.reset());

  it("shows now under a minute, then minutes, hours today, Yesterday, the month and day this year and the full date before it", () => {
    expect([
      ageOf(at(0, 0, 0, 59)),
      ageOf(at(0, 0, 5)),
      ageOf(at(0, 3, 0)),
      ageOf(at(1, 0, 0)),
      ageOf(at(30, 0, 0)),
      ageOf(new Date(2025, 0, 2, 12).toISOString())
    ]).toEqual(["now", "5 min ago", "3 h ago", "Yesterday", "Oct 21", "Jan 2, 2025"]);
  });

  it("shows the date by the date and time format setting, without its time, and again when it changes", () => {
    const before: string[] = [ageOf(at(30, 0, 0)), ageOf(new Date(2025, 0, 2, 12).toISOString())];
    TimeFormatsFixture.use24Hour();

    expect([before, [ageOf(at(30, 0, 0)), ageOf(new Date(2025, 0, 2, 12).toISOString())]]).toEqual([["Oct 21", "Jan 2, 2025"], ["21 Oct", "2 Jan 2025"]]);
  });

  it("keeps a date it can't read as it came", () => {
    expect(ageOf("not a date")).toBe("not a date");
  });

  it("takes the first letters of the first and last words, or the only word's, or nothing from an empty name", () => {
    expect([CommitLabels.initialsOf("ada lovelace byron"), CommitLabels.initialsOf("linus"), CommitLabels.initialsOf("j.doe"), CommitLabels.initialsOf(" "), CommitLabels.initialsOf("𝒜 b")])
      .toEqual(["AB", "L", "JD", "", "𝒜B"]);
  });

  it("gives the same color for the same email in any case, from the avatar colors", () => {
    const colors: string[] = ["a@example.com", "A@EXAMPLE.COM", "b@example.com", ""].map(t => CommitLabels.avatarOf(t));

    expect(colors[0]).toBe(colors[1]);
    expect(colors.every(t => Resources.avatarColors.includes(t))).toBe(true);
    expect(colors[3]).toBe(Resources.avatarColors[0]);
  });
});
