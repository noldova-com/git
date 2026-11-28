/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WritableSignal } from "@angular/core";
import type { CommitQuery } from "@noldova/git.hosting.protocol";
import type { GitRemote } from "@noldova/git.protocol";

export class CommitRead<T> {
  public readonly folder: string;
  public readonly remote: GitRemote;
  public readonly query: CommitQuery;
  public readonly answer: WritableSignal<T | null>;

  public constructor(folder: string, remote: GitRemote, query: CommitQuery, answer: WritableSignal<T | null>) {
    this.folder = folder;
    this.remote = remote;
    this.query = query;
    this.answer = answer;
  }
}
