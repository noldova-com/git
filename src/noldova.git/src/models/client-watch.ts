/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ClientWatch {
  public readonly connection: number;
  public readonly window: number | null;
  public readonly folder: string;
  public count: number = 1;

  public constructor(connection: number, window: number | null, folder: string) {
    this.connection = connection;
    this.window = window;
    this.folder = folder;
  }
}
