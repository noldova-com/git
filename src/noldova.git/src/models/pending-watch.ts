/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PendingWatch {
  public readonly connection: number;
  public readonly window: number | null;
  public readonly folder: string;
  public isCancelled: boolean = false;

  public constructor(connection: number, window: number | null, folder: string) {
    this.connection = connection;
    this.window = window;
    this.folder = folder;
  }
}
