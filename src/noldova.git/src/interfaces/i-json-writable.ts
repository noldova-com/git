/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A value that writes itself as JSON, such as a diff's file, hunk or line. */
export interface IJsonWritable {
  toJson(): unknown;
}
