/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { GitCommitView } from "../models/git-commit-view.ts";
import { Resources } from "../../resources.ts";
import { GitDetailView } from "./git-detail-view.ts";

/** The Commit view of each window, which shows the commit the history document in front chose. */
export class GitCommitDetails {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<GitCommitView>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<GitCommitView> {
    const known: GitDetailView<GitCommitView> | undefined = GitCommitDetails.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view: GitDetailView<GitCommitView> = new GitDetailView<GitCommitView>(context, Resources.commitDetailViewName, Resources.commitDetailViewInstance,
      () => Resources.commitDetailLabel);
    GitCommitDetails.windows.set(context, view);
    return view;
  }
}
