/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, input, type InputSignal, type Signal } from "@angular/core";
import { CodeTextComponent } from "@noldova/code.editor.angular";
import { WindowPartTokens } from "@noldova/desktop.window";

import type { GitConflictDetail } from "../../models/git-conflict-detail.ts";
import { Resources } from "../../../resources.ts";
import { GitConflictDetails } from "../../services/git-conflict-details.ts";

@Component({
  selector: "nol-git-conflict-detail",
  imports: [CodeTextComponent],
  templateUrl: "./git-conflict-detail.component.html",
  styleUrl: "./git-conflict-detail.component.css"
})
export class GitConflictDetailComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly detail: Signal<GitConflictDetail | null> = GitConflictDetails.of(inject(WindowPartTokens.context)).shown;

  public readonly instance: InputSignal<string> = input.required<string>();
}
