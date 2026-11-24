/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, input, type InputSignal, output, type OutputEmitterRef } from "@angular/core";
import { ButtonComponent, ButtonVariant, DialogComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";

/**
 * Asks before a row's working-folder changes are discarded, saying what is lost: an untracked file is deleted, and a
 * tracked one goes back to what is staged, and says whether it can be undone. It answers true for Discard, and false for Cancel, Close or Escape.
 */
@Component({
  selector: "nol-git-discard-dialog",
  imports: [ButtonComponent, DialogComponent],
  templateUrl: "./git-discard-dialog.component.html",
  styleUrl: "./git-discard-dialog.component.css"
})
export class GitDiscardDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;

  public readonly path: InputSignal<string> = input.required<string>();
  public readonly untracked: InputSignal<boolean> = input.required<boolean>();
  /** Whether a checkpoint is kept first, so the discard can be undone. */
  public readonly undoable: InputSignal<boolean> = input.required<boolean>();
  public readonly answered: OutputEmitterRef<boolean> = output<boolean>();
}
