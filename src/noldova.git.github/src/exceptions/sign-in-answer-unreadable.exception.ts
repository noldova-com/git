/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { SignInRefusedException } from "./sign-in-refused.exception.ts";

export class SignInAnswerUnreadableException extends SignInRefusedException {
  public constructor(cause: unknown) {
    super(Resources.signInAnswerUnreadableMessage, new ExceptionOptions(cause));
  }
}
