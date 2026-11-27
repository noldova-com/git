/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostSignIn } from "@noldova/git.hosting.protocol";

export class SignInMethod {
  public readonly name: string;
  public readonly run: (account: number) => HostSignIn | Promise<HostSignIn>;

  public constructor(name: string, run: (account: number) => HostSignIn | Promise<HostSignIn>) {
    this.name = name;
    this.run = run;
  }
}
