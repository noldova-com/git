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
  public readonly undoable: InputSignal<boolean> = input.required<boolean>();
  public readonly answered: OutputEmitterRef<boolean> = output<boolean>();
}
