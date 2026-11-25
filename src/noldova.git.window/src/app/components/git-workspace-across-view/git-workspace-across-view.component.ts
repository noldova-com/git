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

/** The Across repositories view: the workspace page in front, a branch out in several of its repositories, what needs the person, and the agents at work. */
@Component({
  selector: "nol-git-workspace-across-view",
  imports: [GitWorkspaceAcrossComponent],
  templateUrl: "./git-workspace-across-view.component.html",
  styleUrl: "./git-workspace-across-view.component.css"
})
export class GitWorkspaceAcrossViewComponent {
  private readonly across: Signal<GitWorkspaceAcross | null> = GitWorkspaceAcrossViews.of(inject(WindowPartTokens.context)).shown;

  protected readonly resources: typeof Resources = Resources;
  /**
   * What the workspace page in front shows, kept while a document of another kind is, as a list of one or none, so another page's panel starts
   * afresh rather than with the last page's push or pull result.
   */
  protected readonly shown: Signal<readonly GitWorkspaceAcross[]> = computed(() => {
    const across: GitWorkspaceAcross | null = this.across();
    return Object.isNull(across) ? [] : [across];
  });

  /** The view's one instance, which its tab opened with. */
  public readonly instance: InputSignal<string> = input.required<string>();
}
