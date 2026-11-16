/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { GitHubException } from "./github.exception.ts";

export class SignInNotKeptException extends GitHubException {
  public constructor(cause: unknown) {
    super(Resources.signInNotKeptMessage, new ExceptionOptions(cause));
  }
}
