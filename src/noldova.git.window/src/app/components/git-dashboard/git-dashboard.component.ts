/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";

import { Resources } from "../../../resources.ts";
import { GitWindowContext } from "../../services/git-window-context.ts";
import { GitWorkspaceComponent } from "../git-workspace/git-workspace.component.ts";

@Component({
  selector: "nol-git-dashboard",
  imports: [GitWorkspaceComponent],
  templateUrl: "./git-dashboard.component.html",
  styleUrl: "./git-dashboard.component.css",
  providers: [
    { provide: WindowPartTokens.context, useFactory: (): IWindowPartContext => GitWindowContext.current() },
    { provide: WindowPartTokens.activeDocument, useValue: signal(true) }
  ]
})
export class GitDashboardComponent {
  protected readonly instance: string = Resources.openRepositoriesInstance;
}
