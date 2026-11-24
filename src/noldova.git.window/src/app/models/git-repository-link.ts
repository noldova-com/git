/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A row a host module adds to the repository panel under Changes and History, such as one that opens the remote's work items. */
export class GitRepositoryLink {
  public readonly key: string;
  public readonly label: string;
  public readonly icon: string;
  public readonly open: () => void;

  public constructor(key: string, label: string, icon: string, open: () => void) {
    this.key = key;
    this.label = label;
    this.icon = icon;
    this.open = open;
  }
}
