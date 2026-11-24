/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, input, type InputSignal, type Signal } from "@angular/core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { CodeTextComponent } from "@noldova/editor.angular";

import type { GitConflictDetail } from "../../models/git-conflict-detail.ts";
import { Resources } from "../../../resources.ts";
import { GitConflictDetails } from "../../services/git-conflict-details.ts";

/** The Conflict view: the current conflict of the conflicts document in front, with its base, and the check before the commit. */
@Component({
  selector: "nol-git-conflict-detail",
  imports: [CodeTextComponent],
  templateUrl: "./git-conflict-detail.component.html",
  styleUrl: "./git-conflict-detail.component.css"
})
export class GitConflictDetailComponent {
  protected readonly resources: typeof Resources = Resources;
  /** What the conflicts document in front shows, kept while a document of another kind is; `null` once none is open or the one in front shows no file. */
  protected readonly detail: Signal<GitConflictDetail | null> = GitConflictDetails.of(inject(WindowPartTokens.context)).shown;

  /** The view's one instance, which its tab opened with. */
  public readonly instance: InputSignal<string> = input.required<string>();
}
