/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class BranchHead {
  public readonly name: string;
  public readonly id: string;
  public readonly committedAt: string;
  public readonly seconds: string;
  public readonly track: string;

  public constructor(name: string, id: string, committedAt: string, seconds: string, track: string) {
    this.name = name;
    this.id = id;
    this.committedAt = committedAt;
    this.seconds = seconds;
    this.track = track;
  }

  public static parse(record: string): BranchHead {
    const end = (from: number): number => {
      const found: number = record.indexOf(Resources.trackSeparator, from);
      return found < 0 ? record.length : found;
    };
    const first: number = end(0);
    const second: number = end(first + 1);
    const third: number = end(second + 1);
    const fourth: number = end(third + 1);
    return new BranchHead(record.slice(0, first), record.slice(first + 1, second), record.slice(second + 1, third), record.slice(third + 1, fourth),
      record.slice(fourth + 1));
  }
}
