/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, input, type InputSignal, output, type OutputEmitterRef, signal, type Signal, type WritableSignal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GitBranchParams } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, DialogComponent, TextFieldComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";

/**
 * Asks for the name of a branch the workspace creates in several repositories, naming each one. Create stays unavailable until the name is one
 * Git takes, and says why under the field once something is typed. It answers the name for Create or Enter, and null for Cancel, Close or Escape.
 */
@Component({
  selector: "nol-git-bulk-branch-dialog",
  imports: [ButtonComponent, DialogComponent, FormsModule, TextFieldComponent],
  templateUrl: "./git-bulk-branch-dialog.component.html",
  styleUrl: "./git-bulk-branch-dialog.component.css"
})
export class GitBulkBranchDialogComponent {
  public readonly repositories: InputSignal<readonly string[]> = input.required<readonly string[]>();
  public readonly answered: OutputEmitterRef<string | null> = output<string | null>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly title: Signal<string> = computed(() => Resources.formatNewBranchTitle(this.repositories().length));
  protected readonly name: WritableSignal<string> = signal("");
  protected readonly isName: Signal<boolean> = computed(() => GitBranchParams.isBranchName(this.name()));

  protected create(): void {
    if (this.isName())
      this.answered.emit(this.name());
  }
}
