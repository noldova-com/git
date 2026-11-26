/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SubjectPart {
  public readonly text: string;
  public readonly id: number | null;

  public constructor(text: string, id: number | null) {
    this.text = text;
    this.id = id;
  }
}
