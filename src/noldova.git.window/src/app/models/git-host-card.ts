/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { HostAccount } from "@noldova/git.hosting.protocol";

import { GitHostCardState } from "../enums/git-host-card-state.ts";

export class GitHostCard {
  public readonly title: string;
  public readonly detail: string;
  public readonly state: GitHostCardState;
  public readonly label: string;
  public readonly account: string | null;
  public readonly person: HostAccount | null;

  public constructor(title: string, detail: string, state: GitHostCardState, label: string, account: string | null = null, person: HostAccount | null = null) {
    this.title = title;
    this.detail = detail;
    this.state = state;
    this.label = label;
    this.account = account;
    this.person = person;
  }

  public get asksToSignIn(): boolean {
    return this.state === GitHostCardState.SignedOut || this.state === GitHostCardState.Failed;
  }
}
