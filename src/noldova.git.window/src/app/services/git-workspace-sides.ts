/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

import type { GitWorkspaceSide } from "../models/git-workspace-side.ts";
import { Resources } from "../../resources.ts";
import { GitDetailView } from "./git-detail-view.ts";

/**
 * The workspace pages each window follows for its Workspaces view, which shows the views and hosts of the page in front, kept while a document of another
 * kind is; the view stays where the person put it, so this never opens it.
 */
export class GitWorkspaceSides {
  private static readonly windows: WeakMap<IWindowPartContext, GitDetailView<GitWorkspaceSide>> = new WeakMap();

  /**
   * The window's pages.
   * @param context The window part's context.
   * @returns The one follower of the window's workspace pages.
   */
  public static of(context: IWindowPartContext): GitDetailView<GitWorkspaceSide> {
    const known: GitDetailView<GitWorkspaceSide> | undefined = GitWorkspaceSides.windows.get(context);
    if (known !== undefined)
      return known;
    const sides: GitDetailView<GitWorkspaceSide> = new GitDetailView<GitWorkspaceSide>(context, Resources.workspacesViewName, Resources.workspacesViewName,
      () => Resources.workspacesHeading);
    GitWorkspaceSides.windows.set(context, sides);
    return sides;
  }
}
