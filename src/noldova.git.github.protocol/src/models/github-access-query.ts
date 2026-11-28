/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitHubAccessQuery {
  public readonly host: string;
  public readonly path: string;
  public readonly folder: string | null;
  public readonly remote: string | null;

  public constructor(host: string, path: string, folder: string | null = null, remote: string | null = null) {
    this.host = host;
    this.path = path;
    this.folder = folder;
    this.remote = remote;
  }
}
