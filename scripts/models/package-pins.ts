/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export class PackagePins {
  public readonly dependencies: ReadonlyMap<string, string>;
  public readonly peers: ReadonlyMap<string, string>;

  public constructor(dependencies: ReadonlyMap<string, string>, peers: ReadonlyMap<string, string>) {
    this.dependencies = dependencies;
    this.peers = peers;
  }
}
