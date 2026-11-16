/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitHubAccessGrant {
  public readonly token: string;
  public readonly login: string;

  public constructor(token: string, login: string) {
    this.token = token;
    this.login = login;
  }
}
