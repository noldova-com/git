/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, computed, type ElementRef, input, type InputSignal, output, type OutputEmitterRef, type Signal, viewChild } from "@angular/core";
import "@noldova/context.core";
import { type GitPrediction, PredictionOutcome } from "@noldova/git.protocol";

import type { GitBranchDrop } from "../../models/git-branch-drop.ts";
import { Resources } from "../../../resources.ts";

/** What the drop dialog's first line says, with its icon and tone. */
interface DropHeading {
  readonly icon: string;
  readonly text: string;
  readonly tone: string;
}

/**
 * The dialog a branch dropped on another opens at the drop: what a merge of the two would do, read without touching the person's files, then
 * merging into, rebasing onto, or opening a pull request into the target on its host's page, each offered only where it can run now; a merge into a local branch that isn't
 * current is offered with the switch to it first. It focuses the first choice that needs no switch.
 */
@Component({
  selector: "nol-git-branch-drop",
  templateUrl: "./git-branch-drop.component.html",
  styleUrl: "./git-branch-drop.component.css"
})
export class GitBranchDropComponent {
  private readonly box: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("box");

  protected readonly resources: typeof Resources = Resources;
  public readonly drop: InputSignal<GitBranchDrop> = input.required<GitBranchDrop>();
  /** What a merge of the two would do; `null` while it is read, when Git can't tell, or when neither branch is current. */
  public readonly prediction: InputSignal<GitPrediction | null> = input.required<GitPrediction | null>();
  /** Whether the prediction is still being read. */
  public readonly checking: InputSignal<boolean> = input.required<boolean>();
  /** The host's page that opens a pull request of the dropped branch into the target; `null` holds the choice, saying what it needs. */
  public readonly request: InputSignal<string | null> = input.required<string | null>();
  /** Whether a write runs now, which holds the merge. */
  public readonly busy: InputSignal<boolean> = input.required<boolean>();
  /** Where the drop landed, in the window's pixels; the dialog's top-left corner. */
  public readonly left: InputSignal<number> = input.required<number>();
  public readonly top: InputSignal<number> = input.required<number>();
  public readonly merged: OutputEmitterRef<void> = output<void>();
  /** Asks for the switch to the target and the merge into it, when the target isn't current. */
  public readonly switchMerged: OutputEmitterRef<void> = output<void>();
  public readonly rebased: OutputEmitterRef<void> = output<void>();
  /** Asks to open the host's page for the new pull request, with its address. */
  public readonly requested: OutputEmitterRef<string> = output<string>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly heading: Signal<DropHeading | null> = computed(() => {
    if (this.checking())
      return { icon: Resources.dropCheckingIcon, text: Resources.dropChecking, tone: "" };
    const prediction = this.prediction();
    if (Object.isNull(prediction))
      return null;
    switch (prediction.outcome) {
      case PredictionOutcome.Clean:
      case PredictionOutcome.FastForward:
        return { icon: Resources.dropCleanIcon, text: Resources.dropClean, tone: "ok" };
      case PredictionOutcome.UpToDate:
        return { icon: Resources.dropCleanIcon, text: Resources.dropUpToDate, tone: "ok" };
      case PredictionOutcome.Conflicts:
        return { icon: Resources.warningIcon, text: Resources.formatDropConflicts(prediction.paths), tone: "warning" };
      default:
        return null;
    }
  });
  /** The merge's label: into the current branch, or with the switch to the target first. */
  protected readonly mergeLabel: Signal<string> = computed(() => {
    const drop: GitBranchDrop = this.drop();
    return drop.canMerge || !drop.canSwitchAndMerge ? Resources.formatDropMerge(drop.source, drop.target) : Resources.formatDropSwitchMerge(drop.source, drop.target);
  });
  protected readonly detail: Signal<string> = computed(() => {
    const drop = this.drop();
    if (!Object.isNull(drop.predicted))
      return Resources.formatDropChecked(drop);
    return drop.canMerge || drop.canRebase ? Resources.dropSameCommit : Resources.formatDropUnpredicted(drop.source, drop.target);
  });

  public constructor() {
    afterNextRender(() => {
      const box: HTMLElement = this.box().nativeElement;
      (box.querySelector<HTMLButtonElement>("button:enabled:not(.switching)") ?? box.querySelector<HTMLButtonElement>("button:enabled"))?.focus();
    });
  }

  protected close(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }
}
