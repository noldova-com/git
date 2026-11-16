/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SessionBranches {
  private readonly made: Set<string> = new Set();

  public add(session: string, top: string, branch: string): void {
    this.made.add(SessionBranches.keyOf(session, top, branch));
  }

  public has(session: string, top: string, branch: string): boolean {
    return this.made.has(SessionBranches.keyOf(session, top, branch));
  }

  private static keyOf(session: string, top: string, branch: string): string {
    return JSON.stringify([session, top, branch]);
  }
}
