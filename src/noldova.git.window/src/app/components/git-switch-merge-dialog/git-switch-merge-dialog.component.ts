/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, input, type InputSignal, output, type OutputEmitterRef, type Signal } from "@angular/core";
import { ButtonComponent, ButtonVariant, DialogComponent } from "@noldova/ui.components.angular";

import type { GitBranchDrop } from "../../models/git-branch-drop.ts";
import { Resources } from "../../../resources.ts";

/** Asks before a dropped branch merges into one that isn't current, naming both steps: the switch to it, then the merge. It answers true for Switch and merge, and false for Cancel, Close or Escape. */
@Component({
  selector: "nol-git-switch-merge-dialog",
  imports: [ButtonComponent, DialogComponent],
  templateUrl: "./git-switch-merge-dialog.component.html",
  styleUrl: "./git-switch-merge-dialog.component.css"
})
export class GitSwitchMergeDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly text: Signal<string> = computed(() => Resources.formatSwitchMergeText(this.drop().source, this.drop().target));

  public readonly drop: InputSignal<GitBranchDrop> = input.required<GitBranchDrop>();
  public readonly answered: OutputEmitterRef<boolean> = output<boolean>();
}
