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

interface DropHeading {
  readonly icon: string;
  readonly text: string;
  readonly tone: string;
}

@Component({
  selector: "nol-git-branch-drop",
  templateUrl: "./git-branch-drop.component.html",
  styleUrl: "./git-branch-drop.component.css"
})
export class GitBranchDropComponent {
  private readonly box: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("box");

  protected readonly resources: typeof Resources = Resources;
  public readonly drop: InputSignal<GitBranchDrop> = input.required<GitBranchDrop>();
  public readonly prediction: InputSignal<GitPrediction | null> = input.required<GitPrediction | null>();
  public readonly checking: InputSignal<boolean> = input.required<boolean>();
  public readonly request: InputSignal<string | null> = input.required<string | null>();
  public readonly busy: InputSignal<boolean> = input.required<boolean>();
  public readonly left: InputSignal<number> = input.required<number>();
  public readonly top: InputSignal<number> = input.required<number>();
  public readonly merged: OutputEmitterRef<void> = output<void>();
  public readonly switchMerged: OutputEmitterRef<void> = output<void>();
  public readonly rebased: OutputEmitterRef<void> = output<void>();
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
  protected readonly mergeLabel: Signal<string> = computed(() => {
    const drop: GitBranchDrop = this.drop();
    return drop.canMerge || !drop.canSwitchAndMerge ? Resources.formatDropMerge(drop.source, drop.target) : Resources.formatDropSwitchMerge(drop.source, drop.target);
  });
  protected readonly detail: Signal<string> = computed(() => {
    const drop = this.drop();
    if (!Object.isNull(drop.predicted))
      return Resources.formatDropChecked(drop.canMerge, drop.source, drop.target);
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
