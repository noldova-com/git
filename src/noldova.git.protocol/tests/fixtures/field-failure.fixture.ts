/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** The failure a test expects when a field is invalid, by the exception's name, the field and the message. */
export interface IFieldFailure {
  readonly name: string;
  readonly field: string;
  readonly message: string;
}
