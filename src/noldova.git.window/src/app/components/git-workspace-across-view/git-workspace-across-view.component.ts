/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, inject, input, type InputSignal, type Signal } from "@angular/core";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";

import type { GitWorkspaceAcross } from "../../models/git-workspace-across.ts";
import { Resources } from "../../../resources.ts";
import { GitWorkspaceAcrossViews } from "../../services/git-workspace-across-views.ts";
import { GitWorkspaceAcrossComponent } from "../git-workspace-across/git-workspace-across.component.ts";

@Component({
  selector: "nol-git-workspace-across-view",
  imports: [GitWorkspaceAcrossComponent],
  templateUrl: "./git-workspace-across-view.component.html",
  styleUrl: "./git-workspace-across-view.component.css"
})
export class GitWorkspaceAcrossViewComponent {
  private readonly across: Signal<GitWorkspaceAcross | null> = GitWorkspaceAcrossViews.of(inject(WindowPartTokens.context)).shown;

  protected readonly resources: typeof Resources = Resources;
  protected readonly shown: Signal<readonly GitWorkspaceAcross[]> = computed(() => {
    const across: GitWorkspaceAcross | null = this.across();
    return Object.isNull(across) ? [] : [across];
  });

  public readonly instance: InputSignal<string> = input.required<string>();
}
