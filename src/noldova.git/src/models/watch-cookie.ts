/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export class WatchCookie {
  public readonly folder: string;
  public readonly name: string;
  public readonly file: string;
  public readonly seen: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  public isSeen: boolean = false;
  public isWritten: boolean = false;

  public constructor(folder: string, name: string) {
    this.folder = folder;
    this.name = name;
    this.file = path.join(folder, name);
  }

  public markSeen(): void {
    this.isSeen = true;
    this.seen.resolve();
  }
}
