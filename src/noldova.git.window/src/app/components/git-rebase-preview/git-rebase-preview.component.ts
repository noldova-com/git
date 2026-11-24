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

/** The Rebase preview view: the interactive rebase document in front, its branch now and as its rows leave it, and the step that stops on a conflict. */
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
  /** What the rebase document in front shows, kept while a document of another kind is; `null` once none is open or the one in front has no plan read. */
  protected readonly preview: Signal<GitRebasePreview | null> = GitRebasePreviews.of(this.context).shown;

  /** The view's one instance, which its tab opened with. */
  public readonly instance: InputSignal<string> = input.required<string>();

  /** Opens the folder's conflict screen at the file the rebase stopped on. */
  protected showConflict(folder: string, path: string): void {
    GitResolving.open(folder, path);
    this.context.openDocument(Resources.conflictsDocumentName, folder, Resources.formatConflictsTitle(folder));
  }
}
