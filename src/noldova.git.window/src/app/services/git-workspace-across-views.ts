/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { GitWorkspaceAcross } from "../models/git-workspace-across.ts";
import { Resources } from "../../resources.ts";
import { GitDetailView } from "./git-detail-view.ts";

/** The Across repositories view of each window, which shows what spans the repositories of the workspace page in front. */
export class GitWorkspaceAcrossViews {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<GitWorkspaceAcross>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<GitWorkspaceAcross> {
    const known: GitDetailView<GitWorkspaceAcross> | undefined = GitWorkspaceAcrossViews.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view: GitDetailView<GitWorkspaceAcross> = new GitDetailView<GitWorkspaceAcross>(context, Resources.workspaceAcrossViewName,
      Resources.workspaceAcrossViewInstance, () => Resources.acrossHeading);
    GitWorkspaceAcrossViews.windows.set(context, view);
    return view;
  }
}
