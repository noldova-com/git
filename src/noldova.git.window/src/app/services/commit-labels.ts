/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TimeFormatService } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";

export class CommitLabels {
  private static readonly MINUTE: number = 60_000;
  private static readonly HOUR: number = 60 * CommitLabels.MINUTE;

  public static ageOf(iso: string, now: Date, dates: TimeFormatService): string {
    const date: Date = new Date(iso);
    const time: number = date.getTime();
    if (Number.isNaN(time))
      return iso;
    const elapsed: number = now.getTime() - time;
    if (elapsed < CommitLabels.MINUTE)
      return Resources.ageNow;
    if (elapsed < CommitLabels.HOUR)
      return Resources.formatAgeMinutes(Math.floor(elapsed / CommitLabels.MINUTE));
    const startOfToday: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (time >= startOfToday.getTime())
      return Resources.formatAgeHours(Math.floor(elapsed / CommitLabels.HOUR));
    const startOfYesterday: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (time >= startOfYesterday.getTime())
      return Resources.ageYesterday;
    return date.getFullYear() === now.getFullYear() ? dates.shortDate(iso) : dates.date(iso);
  }

  public static initialsOf(name: string): string {
    const letters: string[] = name.split(/[\s._-]+/u).filter(t => t.length > 0).map(t => [...t].slice(0, 1).join(""));
    return [...letters.slice(0, 1), ...letters.slice(1).slice(-1)].join("").toLocaleUpperCase(Resources.dateLocale);
  }

  public static avatarOf(email: string): string {
    let hash = 0;
    for (const point of Array.from(email.toLowerCase(), t => t.codePointAt(0)))
      hash = (hash * 31 + Number(point)) >>> 0;
    const index: number = hash % Resources.avatarColors.length;
    return Resources.avatarColors.slice(index, index + 1).join("");
  }
}
