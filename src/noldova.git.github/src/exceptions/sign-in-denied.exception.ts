/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { GitHubException } from "./github.exception.ts";

export class SignInDeniedException extends GitHubException {
  public constructor() {
    super(Resources.signInDeniedMessage);
  }
}
