/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

/** How an app wants the Git view laid out. */
export class GitViewOptions {
  /** Whether the view starts with the branch card; an app that shows branches, Pull and Push elsewhere turns it off, and the view titles its changes instead. */
  public static readonly showsBranch: WritableSignal<boolean> = signal(true);
  /**
   * Whether the module offers its AI features: Suggest on the commit message, Explain in a commit's detail and Tidy up for review on the
   * rebase screen; off by default, so an app that turns it on runs them, and none of them shows while it is off.
   */
  public static readonly showsAiFeatures: WritableSignal<boolean> = signal(false);
}
