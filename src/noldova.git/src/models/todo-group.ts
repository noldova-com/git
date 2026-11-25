/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** One group of a rebase's todo: a kept step and the steps folded into it, with the message the group's commit ends with. */
export class TodoGroup {
  private lastId: string;
  private groupMessage: string | null;
  private readonly groupIds: string[];

  public constructor(id: string, message: string | null) {
    this.lastId = id;
    this.groupMessage = message;
    this.groupIds = [id];
  }

  /** The last step's commit, which a `fixup -C` of the message follows. */
  public get last(): string {
    return this.lastId;
  }

  /** The message the group's commit takes, or `null` to keep the kept step's own. */
  public get message(): string | null {
    return this.groupMessage;
  }

  /** The commits of the group's steps, in order. */
  public get ids(): readonly string[] {
    return this.groupIds;
  }

  /** Folds a step into the group; a step's message replaces the group's, and a step without one keeps it. */
  public fold(id: string, message: string | null): void {
    this.lastId = id;
    this.groupMessage = message ?? this.groupMessage;
    this.groupIds.push(id);
  }
}
