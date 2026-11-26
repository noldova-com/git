/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { GitConflictDetail } from "../models/git-conflict-detail.ts";
import { Resources } from "../../resources.ts";
import { GitDetailView } from "./git-detail-view.ts";

export class GitConflictDetails {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<GitConflictDetail>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<GitConflictDetail> {
    const known: GitDetailView<GitConflictDetail> | undefined = GitConflictDetails.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view: GitDetailView<GitConflictDetail> = new GitDetailView<GitConflictDetail>(context, Resources.conflictDetailViewName,
      Resources.conflictDetailViewInstance, () => Resources.conflictDetailLabel);
    GitConflictDetails.windows.set(context, view);
    return view;
  }
}
