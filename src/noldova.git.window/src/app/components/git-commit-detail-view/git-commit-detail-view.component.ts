/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, input, type InputSignal, type Signal } from "@angular/core";
import { WindowPartTokens } from "@noldova/desktop.window";

import type { GitCommitView } from "../../models/git-commit-view.ts";
import { Resources } from "../../../resources.ts";
import { GitCommitDetails } from "../../services/git-commit-details.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitCommitDetailComponent } from "../git-commit-detail/git-commit-detail.component.ts";

@Component({
  selector: "nol-git-commit-detail-view",
  imports: [GitCommitDetailComponent],
  providers: [GitViewStateService],
  templateUrl: "./git-commit-detail-view.component.html",
  styleUrl: "./git-commit-detail-view.component.css"
})
export class GitCommitDetailViewComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly shown: Signal<GitCommitView | null> = GitCommitDetails.of(inject(WindowPartTokens.context)).shown;

  public readonly instance: InputSignal<string> = input.required<string>();
}
