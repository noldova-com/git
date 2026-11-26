/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OperationKind } from "@noldova/git.protocol";

export class OperationHead {
  public readonly file: string;
  public readonly kind: OperationKind;

  public constructor(file: string, kind: OperationKind) {
    this.file = file;
    this.kind = kind;
  }
}
