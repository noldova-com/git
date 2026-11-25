/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** What a request to Azure DevOps sends beyond a plain read: its method, its extra headers and its body; a read leaves them all out. */
export interface IRequestWrite {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}
