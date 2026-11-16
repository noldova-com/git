/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ChangedPaths {
  public readonly paths: readonly string[];
  public readonly isTruncated: boolean;
  public readonly digest: string;

  public constructor(paths: readonly string[], isTruncated: boolean, digest: string) {
    this.paths = paths;
    this.isTruncated = isTruncated;
    this.digest = digest;
  }

  public get isEmpty(): boolean {
    return this.paths.length === 0 && !this.isTruncated;
  }

  public equals(other: ChangedPaths): boolean {
    return this.digest === other.digest;
  }
}
