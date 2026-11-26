/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitDetailView } from "@noldova/git.window";

import type { PullRequestChoice } from "../models/pull-request-choice.ts";
import { Resources } from "../../resources.ts";

export class PullRequestSelection {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<PullRequestChoice>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<PullRequestChoice> {
    const known = PullRequestSelection.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view = new GitDetailView<PullRequestChoice>(context, Resources.pullRequestView, Resources.pullRequestViewInstance,
      t => Resources.formatPullRequestViewTitle(t.pullRequest.item.reference.number));
    PullRequestSelection.windows.set(context, view);
    return view;
  }
}
