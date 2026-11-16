/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SignInNotice {
  public readonly title: string;
  public readonly hint: string;

  public constructor(title: string, hint: string) {
    this.title = title;
    this.hint = hint;
  }
}
