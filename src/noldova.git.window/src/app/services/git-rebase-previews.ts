/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { GitRebasePreview } from "../models/git-rebase-preview.ts";
import { Resources } from "../../resources.ts";
import { GitDetailView } from "./git-detail-view.ts";

export class GitRebasePreviews {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<GitRebasePreview>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<GitRebasePreview> {
    const known: GitDetailView<GitRebasePreview> | undefined = GitRebasePreviews.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const view: GitDetailView<GitRebasePreview> = new GitDetailView<GitRebasePreview>(context, Resources.rebasePreviewViewName,
      Resources.rebasePreviewViewInstance, () => Resources.rebasePreviewLabel);
    GitRebasePreviews.windows.set(context, view);
    return view;
  }
}
