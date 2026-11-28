/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { RuntimeRequestException, type TimeFormatService } from "@noldova/desktop.window";
import { HostingNames } from "@noldova/git.hosting.protocol";

import { Resources } from "../../resources.ts";

export class GitHostFailure {
  public readonly message: string;
  public readonly limitedUntil: number | null;

  private constructor(message: string, limitedUntil: number | null) {
    this.message = message;
    this.limitedUntil = limitedUntil;
  }

  public static of(error: unknown, fallback: string): GitHostFailure {
    if (!(error instanceof RuntimeRequestException))
      return new GitHostFailure(fallback, null);
    const until = error.details?.[HostingNames.rateLimitedUntilDetail];
    return new GitHostFailure(error.message, Object.isNumber(until) && Number.isSafeInteger(until) ? until : null);
  }

  public textOf(hostName: string, dates: TimeFormatService): string {
    return Object.isNull(this.limitedUntil) ? this.message : Resources.formatRateLimited(hostName, dates.dateTime(this.limitedUntil));
  }
}
