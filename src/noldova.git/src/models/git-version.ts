/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** A git version, as its major and minor numbers, such as the oldest git a feature needs. */
export class GitVersion {
  public readonly major: number;
  public readonly minor: number;

  public constructor(major: number, minor: number) {
    this.major = major;
    this.minor = minor;
  }

  /** Whether a git of the given major and minor numbers is this version or newer. */
  public isReachedBy(major: number, minor: number): boolean {
    return major > this.major || (major === this.major && minor >= this.minor);
  }
}
