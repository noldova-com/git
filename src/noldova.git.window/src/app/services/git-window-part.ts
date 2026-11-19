/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContentPadding, DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/desktop.window";
import { GitNames } from "@noldova/git.protocol";

import { Resources } from "../../resources.ts";

export class GitWindowPart implements IWindowPart {
  private context: IWindowPartContext | null = null;

  public readonly moduleId: string = GitNames.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public get isActive(): boolean {
    return this.context !== null;
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    this.context = context;
    context.registerView(new ViewContribution(Resources.viewName, Resources.viewTitle, Resources.viewIcon, DockSide.Right, true,
      () => import("../components/git-view/git-view.component.ts").then(t => t.GitViewComponent), ContentPadding.None,
      { defaultGroup: Resources.viewDefaultGroup, defaultOrder: Resources.viewDefaultOrder }));
  }

  public async reconnectAsync(): Promise<boolean> {
    return this.context !== null;
  }

  public async deactivateAsync(): Promise<void> {
    this.context = null;
  }
}

export const windowPart: IWindowPart = new GitWindowPart();
