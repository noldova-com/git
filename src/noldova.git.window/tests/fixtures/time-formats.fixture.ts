/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FakeTimeFormats } from "@noldova/desktop.window/testing";

// The time and date format settings every spec's window follows: the shell's 12-hour defaults, until a spec changes them.
export class TimeFormatsFixture {
  public static readonly formats: FakeTimeFormats = new FakeTimeFormats();
  public static readonly time: string = "h:mm a";
  public static readonly dateTime: string = "MMM d, yyyy, h:mm a";
  public static readonly time24: string = "HH:mm";
  public static readonly dateTime24: string = "d MMM yyyy, HH:mm";

  // Sets both settings to 24-hour patterns with the day before the month.
  public static use24Hour(): void {
    TimeFormatsFixture.formats.use(TimeFormatsFixture.time24, TimeFormatsFixture.dateTime24);
  }

  public static reset(): void {
    TimeFormatsFixture.formats.use(TimeFormatsFixture.time, TimeFormatsFixture.dateTime);
  }
}
