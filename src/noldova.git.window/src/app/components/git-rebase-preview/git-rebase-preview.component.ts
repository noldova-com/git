/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, input, type InputSignal, type Signal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ButtonComponent, ButtonVariant } from "@noldova/ui.components.angular";

import type { GitRebasePreview } from "../../models/git-rebase-preview.ts";
import { Resources } from "../../../resources.ts";
import { GitRebasePreviews } from "../../services/git-rebase-previews.ts";
import { GitResolving } from "../../services/git-resolving.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";

@Component({
  selector: "nol-git-rebase-preview",
  imports: [ButtonComponent, GitReferenceTextComponent],
  templateUrl: "./git-rebase-preview.component.html",
  styleUrl: "./git-rebase-preview.component.css"
})
export class GitRebasePreviewComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly preview: Signal<GitRebasePreview | null> = GitRebasePreviews.of(this.context).shown;

  public readonly instance: InputSignal<string> = input.required<string>();

  protected showConflict(folder: string, path: string): void {
    GitResolving.open(folder, path);
    this.context.openDocument(Resources.conflictsDocumentName, folder, Resources.formatConflictsTitle(folder));
  }
}
