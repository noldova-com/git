/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";

import { FollowedPullRequestPage } from "../models/followed-pull-request-page.ts";

export class PullRequestPages {
  private static readonly pages: WritableSignal<readonly FollowedPullRequestPage[]> = signal<readonly FollowedPullRequestPage[]>([]);

  public static follow(instance: Signal<string>, active: Signal<boolean>): () => void {
    const page: FollowedPullRequestPage = new FollowedPullRequestPage(instance, active);
    PullRequestPages.pages.set([...PullRequestPages.pages(), page]);
    return () => PullRequestPages.pages.set(PullRequestPages.pages().filter(t => t !== page));
  }

  public static isActive(instance: string): boolean {
    return PullRequestPages.pages().some(t => t.active() && t.instance() === instance);
  }
}
