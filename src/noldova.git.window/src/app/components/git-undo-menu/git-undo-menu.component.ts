/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, inject } from "@angular/core";
import { TimeFormatService } from "@noldova/desktop.window";
import { type GitJournalEntry, UndoMode } from "@noldova/git.protocol";
import { IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";

@Component({
  selector: "nol-git-undo-menu",
  imports: [IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TooltipDirective],
  templateUrl: "./git-undo-menu.component.html"
})
export class GitUndoMenuComponent {
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly dates: TimeFormatService = inject(TimeFormatService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly state: GitViewStateService = inject(GitViewStateService);

  protected read(): void {
    this.state.readRecentActionsAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  protected labelOf(entry: GitJournalEntry): string {
    return Resources.formatRecentAction(entry.method, entry.branch);
  }

  protected timeOf(entry: GitJournalEntry): string {
    return this.dates.shortDateTime(entry.at);
  }

  protected canUndo(entry: GitJournalEntry): boolean {
    return entry.undo !== UndoMode.None;
  }

  protected undo(entry: GitJournalEntry): void {
    void this.state.undoEntryAsync(entry);
  }
}
