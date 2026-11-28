/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostSignIn } from "@noldova/git.hosting.protocol";

export class EnterpriseEntry {
  public readonly id: number;
  public readonly host: string;
  public readonly signIn: HostSignIn;

  public constructor(id: number, host: string, signIn: HostSignIn) {
    this.id = id;
    this.host = host;
    this.signIn = signIn;
  }
}
