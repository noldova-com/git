/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GitHostCardState } from "../enums/git-host-card-state.ts";

/** One account or sign-in a host shows on Accounts and hosts: its title, the line under it, and its state's chip or action. */
export class GitHostCard {
  public readonly title: string;
  public readonly detail: string;
  public readonly state: GitHostCardState;
  public readonly label: string;

  public constructor(title: string, detail: string, state: GitHostCardState, label: string) {
    this.title = title;
    this.detail = detail;
    this.state = state;
    this.label = label;
  }

  /** Whether the card ends with a button that opens the host's sign-in, rather than a chip: while it is signed out or its sign-in failed. */
  public get asksToSignIn(): boolean {
    return this.state === GitHostCardState.SignedOut || this.state === GitHostCardState.Failed;
  }
}
