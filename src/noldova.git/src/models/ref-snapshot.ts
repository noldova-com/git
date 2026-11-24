/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { GitRefMove } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";

/** Where a repository's local branches, tags and HEAD point at one moment, and its index's tree when it was read. */
export class RefSnapshot {
  /** The checked-out branch's short name, or null when HEAD is detached. */
  public readonly branch: string | null;
  /** HEAD's commit, or null on an unborn branch. */
  public readonly head: string | null;
  /** Each local branch's and tag's full name with the object it names. */
  public readonly refs: ReadonlyMap<string, string>;
  /** The index's tree, or null when it wasn't read or holds conflicts. */
  public readonly index: string | null;

  public constructor(branch: string | null, head: string | null, refs: ReadonlyMap<string, string>, index: string | null) {
    this.branch = branch;
    this.head = head;
    this.refs = refs;
    this.index = index;
  }

  /** HEAD's own commit when it is detached, or its branch's full name's commit, as a ref move names it. */
  public valueOf(name: string): string | null {
    return name === Resources.headRevision ? this.head : this.refs.get(name) ?? null;
  }

  /** The refs that differ from `before` to `after`, with HEAD itself when either side is detached and its commit changed. */
  public static movesBetween(before: RefSnapshot, after: RefSnapshot): GitRefMove[] {
    const names = new Set([...before.refs.keys(), ...after.refs.keys()]);
    const moves = [...names].sort().filter(t => before.valueOf(t) !== after.valueOf(t)).map(t => new GitRefMove(t, before.valueOf(t), after.valueOf(t)));
    if ((before.branch === null || after.branch === null) && before.head !== after.head)
      moves.unshift(new GitRefMove(Resources.headRevision, before.head, after.head));
    return moves;
  }
}
