/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";

import { FollowedPullRequestPage } from "../models/followed-pull-request-page.ts";

/** The pull request pages open, each with its pull request and whether it's the window's active document, so the pull request's row can show it in front. */
export class PullRequestPages {
  private static readonly pages: WritableSignal<readonly FollowedPullRequestPage[]> = signal<readonly FollowedPullRequestPage[]>([]);

  /** Adds a page, with its document's instance, until the returned function is called. */
  public static follow(instance: Signal<string>, active: Signal<boolean>): () => void {
    const page: FollowedPullRequestPage = new FollowedPullRequestPage(instance, active);
    PullRequestPages.pages.set([...PullRequestPages.pages(), page]);
    return () => PullRequestPages.pages.set(PullRequestPages.pages().filter(t => t !== page));
  }

  /** Whether a page showing the pull request, by its document's instance, is the window's active document; read inside a reactive context, it follows. */
  public static isActive(instance: string): boolean {
    return PullRequestPages.pages().some(t => t.active() && t.instance() === instance);
  }
}
