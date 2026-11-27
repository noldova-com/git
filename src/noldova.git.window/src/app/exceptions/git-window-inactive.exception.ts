/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";
import { GitWindowException } from "./git-window.exception.ts";

export class GitWindowInactiveException extends GitWindowException {
  public override readonly name: string = "GitWindowInactiveException";

  public constructor() {
    super(Resources.windowInactive);
  }
}
