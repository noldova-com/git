/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Failure, type FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export class GitHubUnreachableException extends MethodFailureException {
  public constructor(code: FailureCode) {
    super(new Failure(code, Resources.unreachableMessage));
  }
}
