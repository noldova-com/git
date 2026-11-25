/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostSignIn } from "@noldova/git.hosting.protocol";

/** A sign-in method the module registers, by its name, and the step it runs, which answers with the sign-in after it. */
export class SignInMethod {
  public readonly name: string;
  public readonly run: () => HostSignIn | Promise<HostSignIn>;

  public constructor(name: string, run: () => HostSignIn | Promise<HostSignIn>) {
    this.name = name;
    this.run = run;
  }
}
