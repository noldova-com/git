/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class GitHubAccessGrant {
  public readonly token: string;
  public readonly login: string;
  public readonly host: string;

  public constructor(token: string, login: string, host: string = Resources.gitHubHost) {
    this.token = token;
    this.login = login;
    this.host = host;
  }
}
