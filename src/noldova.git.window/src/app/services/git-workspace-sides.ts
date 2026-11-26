/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import type { GitWorkspaceSide } from "../models/git-workspace-side.ts";
import { Resources } from "../../resources.ts";
import { GitDetailView } from "./git-detail-view.ts";

export class GitWorkspaceSides {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<GitWorkspaceSide>> = new WeakMap();

  public static of(context: IWindowPartContext): GitDetailView<GitWorkspaceSide> {
    const known: GitDetailView<GitWorkspaceSide> | undefined = GitWorkspaceSides.windows.get(context);
    if (!Object.isUndefined(known))
      return known;
    const sides: GitDetailView<GitWorkspaceSide> = new GitDetailView<GitWorkspaceSide>(context, Resources.workspacesViewName, Resources.workspacesViewName,
      () => Resources.workspacesHeading, false);
    GitWorkspaceSides.windows.set(context, sides);
    return sides;
  }
}
