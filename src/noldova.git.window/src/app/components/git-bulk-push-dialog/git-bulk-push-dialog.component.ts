/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, input, type InputSignal, output, type OutputEmitterRef, type Signal } from "@angular/core";
import { ButtonComponent, ButtonVariant, DialogComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import type { GitBulkTarget } from "../../models/git-bulk-target.ts";
import { GitWorkspaceOverview } from "../../models/git-workspace-overview.ts";

/**
 * Asks once before the workspace pushes a branch in several repositories, naming each repository, the branch and the upstream and remote it goes
 * to, and each repository it skips for having no upstream. It answers true for Push, and false for Cancel, Close or Escape.
 */
@Component({
  selector: "nol-git-bulk-push-dialog",
  imports: [ButtonComponent, DialogComponent],
  templateUrl: "./git-bulk-push-dialog.component.html",
  styleUrl: "./git-bulk-push-dialog.component.css"
})
export class GitBulkPushDialogComponent {
  public readonly branch: InputSignal<string> = input.required<string>();
  public readonly targets: InputSignal<readonly GitBulkTarget[]> = input.required<readonly GitBulkTarget[]>();
  public readonly answered: OutputEmitterRef<boolean> = output<boolean>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly title: Signal<string> = computed(() => Resources.formatPushAllTitle(this.branch()));
  /** What each repository will push, or that it is skipped, in the order the card lists them. */
  protected readonly lines: Signal<readonly string[]> = computed(() => this.targets().map(t => t.upstream === null ? Resources.formatPushSkipped(t.repository, t.branch)
    : Resources.formatPushTarget(t.repository, t.branch, t.upstream, GitWorkspaceOverview.placeOf(t.remote))));
}
