/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitCommentsLink {
  public readonly text: string;
  public readonly url: string;

  public constructor(text: string, url: string) {
    this.text = text;
    this.url = url;
  }
}
