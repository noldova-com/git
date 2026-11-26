/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitRefMove } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";

export class RefSnapshot {
  public readonly branch: string | null;
  public readonly head: string | null;
  public readonly refs: ReadonlyMap<string, string>;
  public readonly index: string | null;

  public constructor(branch: string | null, head: string | null, refs: ReadonlyMap<string, string>, index: string | null) {
    this.branch = branch;
    this.head = head;
    this.refs = refs;
    this.index = index;
  }

  public valueOf(name: string): string | null {
    return name === Resources.headRevision ? this.head : this.refs.get(name) ?? null;
  }

  public static movesBetween(before: RefSnapshot, after: RefSnapshot): GitRefMove[] {
    const names = new Set([...before.refs.keys(), ...after.refs.keys()]);
    const moves = [...names].sort().filter(t => before.valueOf(t) !== after.valueOf(t)).map(t => new GitRefMove(t, before.valueOf(t), after.valueOf(t)));
    if ((before.branch === null || after.branch === null) && before.head !== after.head)
      moves.unshift(new GitRefMove(Resources.headRevision, before.head, after.head));
    return moves;
  }
}
