/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { LinkPlace } from "@noldova/desktop.window";

/** A link the host row couldn't open, with the place it asked for, so Open again asks the same. */
export class FailedLink {
  public readonly url: string;
  public readonly place: LinkPlace | null;

  public constructor(url: string, place: LinkPlace | null) {
    this.url = url;
    this.place = place;
  }
}
