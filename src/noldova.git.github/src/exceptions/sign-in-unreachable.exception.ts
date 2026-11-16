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

export class SignInUnreachableException extends GitHubException {
  public readonly url: string;

  public constructor(url: string, cause: unknown) {
    super(Resources.formatSignInUnreachable(url), new ExceptionOptions(cause));

    this.url = url;
  }
}
