/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A run of a commit's subject: plain text, or a work item's reference as the subject writes it, `#N` or `AB#N`, with the item's id. */
export class SubjectPart {
  public readonly text: string;
  /** The work item's id when the run names one, or `null` for plain text. */
  public readonly id: number | null;

  public constructor(text: string, id: number | null) {
    this.text = text;
    this.id = id;
  }
}
