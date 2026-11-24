/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Which choice resolved a conflicted file on the conflict screen, which its Resolved row notes. */
export enum GitResolvedBy {
  /** Took our side of the whole file. */
  Ours = "Ours",
  /** Took their side of the whole file. */
  Theirs = "Theirs",
  /** Kept both sides of every conflict in the merge editor, in either order. */
  Both = "Both",
  /** Wrote the result some other way: by hand, or a mix of choices. */
  Edited = "Edited",
  /** Deleted the file. */
  Deleted = "Deleted"
}
