/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TodoGroup {
  private lastId: string;
  private groupMessage: string | null;
  private readonly groupIds: string[];

  public constructor(id: string, message: string | null) {
    this.lastId = id;
    this.groupMessage = message;
    this.groupIds = [id];
  }

  public get last(): string {
    return this.lastId;
  }

  public get message(): string | null {
    return this.groupMessage;
  }

  public get ids(): readonly string[] {
    return this.groupIds;
  }

  public fold(id: string, message: string | null): void {
    this.lastId = id;
    this.groupMessage = message ?? this.groupMessage;
    this.groupIds.push(id);
  }
}
