/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, ErrorHandler, inject, Injector, input, type InputSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { type GitRebasePlan, type GitRebaseStepCheck, type GitStatus, OperationKind, RebaseAction, RebaseCheckOutcome, type RebaseStep } from "@noldova/git.protocol";
import { FormsModule } from "@angular/forms";
import { ButtonComponent, ButtonVariant, CheckboxComponent, SelectComponent, SelectOption, TextFieldComponent, ToolbarButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitRebaseLanding } from "../../models/git-rebase-landing.ts";
import { GitRebasePreview, type IGitRebaseStop } from "../../models/git-rebase-preview.ts";
import { GitRebaseRow } from "../../models/git-rebase-row.ts";
import { GitRebaseStart } from "../../models/git-rebase-start.ts";
import type { GitDetailView } from "../../services/git-detail-view.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitRebasePreviews } from "../../services/git-rebase-previews.ts";
import { type GitRebaseTarget, GitRebasing } from "../../services/git-rebasing.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewOptions } from "../../services/git-view-options.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";
import type { GitRebaseRowPlan } from "../../models/git-rebase-row-plan.ts";

interface IRowCheck {
  readonly icon: string;
  readonly tone: string;
  readonly text: string;
}

interface IRowItem {
  readonly row: GitRebaseRow;
  readonly check: IRowCheck;
}

@Component({
  selector: "nol-git-rebase",
  imports: [ButtonComponent, CheckboxComponent, FormsModule, GitReferenceTextComponent, SelectComponent, TextFieldComponent, ToolbarButtonComponent],
  providers: [GitViewStateService],
  templateUrl: "./git-rebase.component.html",
  styleUrl: "./git-rebase.component.css"
})
export class GitRebaseComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly client: GitRuntimeClient = new GitRuntimeClient(this.context);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private checks = 0;
  private readonly injector: Injector = inject(Injector);
  private drops = 0;
  private advices = 0;
  private reads = 0;
  private readonly blank: HTMLImageElement = Object.assign(new Image(), { src: Resources.blankDragImage });
  private grab = 0;

  protected readonly resources: typeof Resources = Resources;
  protected readonly showsAiFeatures: Signal<boolean> = GitViewOptions.showsAiFeatures;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly actions: readonly SelectOption[] = Object.values(RebaseAction).map(t => new SelectOption(t, Resources.rebaseActionTitles[t]));
  protected readonly target: Signal<GitRebaseTarget | null> = computed(() => GitRebasing.targetOf(this.instance()));
  protected readonly plan: WritableSignal<GitRebasePlan | null> = signal<GitRebasePlan | null>(null);
  protected readonly readFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly rows: WritableSignal<readonly GitRebaseRow[]> = signal<readonly GitRebaseRow[]>([]);
  protected readonly selected: WritableSignal<number> = signal(0);
  protected readonly dragged: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly dropAt: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly liftTop: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly landing: Signal<GitRebaseLanding | null> = computed(() => {
    const from = this.dragged();
    const gap = this.dropAt();
    if (Object.isNull(from))
      return null;
    const to = Object.isNull(gap) ? from : gap > from ? gap - 1 : gap;
    return new GitRebaseLanding(to, to === from ? this.rows() : GitRebaseRow.move(this.rows(), from, to));
  });
  protected readonly landedChecks: WritableSignal<readonly GitRebaseStepCheck[] | null> = signal<readonly GitRebaseStepCheck[] | null>(null);
  protected readonly lifted: Signal<readonly IRowItem[]> = computed(() => {
    const landing = this.landing();
    if (Object.isNull(landing) || Object.isNull(this.liftTop()))
      return [];
    const items = GitRebaseRow.isValid(landing.rows)
      ? GitRebaseComponent.checksOf(landing.rows, landing.rows === this.rows() ? this.stepChecks() : this.landedChecks(), Resources.droppedClean)
      : landing.rows.map(row => ({ row, check: { icon: Resources.checkIcons.Unavailable, tone: Resources.warningTone, text: Resources.droppedRefused } }));
    return items.slice(landing.to, landing.to + 1).map(t => ({ row: t.row, check: { ...t.check, text: Resources.formatDroppedHere(t.check.text) } }));
  });
  protected readonly advice: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly moveStacked: WritableSignal<boolean> = signal(true);
  protected readonly foldFixups: WritableSignal<boolean> = signal(true);
  protected readonly stepChecks: WritableSignal<readonly GitRebaseStepCheck[] | null> = signal<readonly GitRebaseStepCheck[] | null>(null);
  protected readonly planned: Signal<GitRebaseRowPlan> = computed(() => GitRebaseRow.planOf(this.rows()));
  protected readonly valid: Signal<boolean> = computed(() => GitRebaseRow.isValid(this.rows()));
  protected readonly items: Signal<readonly IRowItem[]> = computed(() =>
    GitRebaseComponent.checksOf(this.rows(), this.stepChecks(), Resources.appliesCleanly));
  protected readonly stop: Signal<IGitRebaseStop | null> = computed(() => {
    const checks = this.stepChecks() ?? [];
    const found = checks.find(t => t.outcome === RebaseCheckOutcome.Conflicts);
    const index = Object.isUndefined(found) ? -1 : checks.indexOf(found);
    const row = this.rows().at(index);
    return Object.isUndefined(found) || Object.isUndefined(row) ? null : { step: index + 1, paths: found.paths, commit: GitRebaseComponent.shortOf(row.commit.id) };
  });
  private readonly status: Signal<GitStatus | null> = computed(() => this.state.folder() === this.instance() ? this.state.status() : null);
  private readonly checkedOut: Signal<GitStatus | null> = computed(() => {
    const status = this.status();
    return Object.isNull(status) || !Object.isNull(status.operation) ? null : status;
  });
  protected readonly stopped: Signal<string | null> = computed(() => {
    const status = this.status();
    if (status?.operation?.kind !== OperationKind.Rebase)
      return null;
    return status.entries.find(t => !Object.isNull(t.conflict))?.path ?? null;
  });
  protected readonly ontoName: Signal<string> = computed(() => this.target()?.name ?? "");
  protected readonly heading: Signal<string> = computed(() => Resources.formatRebaseHeading(this.rows().length, this.plan()?.branch ?? null, this.ontoName()));
  protected readonly after: Signal<readonly string[]> = computed(() => this.planned().results.toReversed());
  protected readonly summary: Signal<string> = computed(() => {
    const summary = Resources.formatCommitsBecome(this.rows().length, this.planned().results.length);
    const advice = this.advice();
    return Object.isNull(advice) ? summary : Resources.formatWithAdvice(summary, advice);
  });
  protected readonly preview: Signal<GitRebasePreview | null> = computed(() => {
    const plan = this.plan();
    return Object.isNull(plan) ? null : new GitRebasePreview(this.instance(), plan, this.ontoName(), this.rows().length, this.moveStacked() ? plan.stacked : [],
      this.after().map(t => this.subjectOf(t)), this.stop(), this.stopped());
  });
  protected readonly start: Signal<GitRebaseStart | null> = computed(() => {
    const target = this.target();
    const plan = this.plan();
    const status = this.status();
    const ready = !this.state.busy() && this.rows().length > 0 && this.valid();
    return !Object.isNull(status) && ready && !Object.isNull(target) && !Object.isNull(plan) && this.isCurrent(plan, status) ? new GitRebaseStart(target, plan) : null;
  });

  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    let readFor: GitRebaseTarget | null | undefined;
    effect(() => {
      const target = this.target();
      const checkedOut = this.checkedOut();
      untracked(() => {
        const plan = this.plan();
        if (target === readFor && (Object.isNull(checkedOut) || Object.isNull(plan) || this.isCurrent(plan, checkedOut)))
          return;
        readFor = target;
        this.run(this.readAsync(target));
      });
    });
    effect(() => {
      const steps = this.planned().steps;
      const target = this.target();
      if (!Object.isNull(target) && steps.length > 0 && this.valid())
        untracked(() => this.run(this.checkAsync(target, steps)));
    });
    effect(() => {
      const landing = this.landing();
      const target = this.target();
      const drop = ++this.drops;
      this.landedChecks.set(null);
      if (!Object.isNull(landing) && !Object.isNull(target) && landing.rows !== untracked(this.rows) && GitRebaseRow.isValid(landing.rows))
        untracked(() => this.run(this.checkDropAsync(drop, target, landing.rows)));
    });
    effect(() => {
      const stop = this.stop();
      const target = this.target();
      const dragging = !Object.isNull(this.dragged());
      const advice = ++this.advices;
      this.advice.set(null);
      if (!Object.isNull(stop) && !Object.isNull(target) && !dragging)
        untracked(() => this.run(this.adviseAsync(advice, target, this.rows(), stop)));
    });
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    inject(DestroyRef).onDestroy(GitFolder.follow(this.instance, active));
    const previews: GitDetailView<GitRebasePreview> = GitRebasePreviews.of(this.context);
    previews.follow(this.preview, active, this.injector);
  }

  protected shortOf(id: string): string {
    return GitRebaseComponent.shortOf(id);
  }

  protected subjectOf(message: string): string {
    return message.split(Resources.messageLineEnd, 1).join("");
  }

  protected select(index: number): void {
    this.selected.set(index);
  }

  protected setAction(index: number, action: string): void {
    const chosen = Object.values(RebaseAction).find(t => t === action);
    if (!Object.isUndefined(chosen))
      this.rows.update(t => t.map((item, at) => at === index ? item.withAction(chosen) : item));
  }

  protected setSubject(index: number, subject: string): void {
    this.rows.update(t => t.map((item, at) => {
      if (at !== index)
        return item;
      const [, ...body] = (item.message ?? item.commit.message).split(Resources.messageLineEnd);
      return item.withMessage([subject, ...body].join(Resources.messageLineEnd));
    }));
  }

  protected setFold(plan: GitRebasePlan, fold: boolean): void {
    this.foldFixups.set(fold);
    this.rows.set(GitRebaseRow.arrange(plan.commits, fold));
  }

  protected keydown(event: KeyboardEvent, index: number): void {
    if (event.target instanceof HTMLInputElement)
      return;
    const step = event.key === Resources.arrowUpKey ? -1 : event.key === Resources.arrowDownKey ? 1 : 0;
    const action = event.ctrlKey || event.metaKey || event.altKey ? undefined : Resources.rebaseActionKeys[event.key.toLowerCase()];
    if (step !== 0 && event.altKey)
      this.moveRow(index, index + step);
    else if (step !== 0)
      this.focusRow(Math.min(Math.max(index + step, 0), this.rows().length - 1));
    else if (!Object.isUndefined(action))
      this.setAction(index, action);
    else
      return;
    event.preventDefault();
  }

  protected dragStart(event: DragEvent, index: number, row: HTMLElement): void {
    this.dragged.set(index);
    this.liftTop.set(null);
    this.grab = event.clientY - row.getBoundingClientRect().top;
    event.dataTransfer?.setData(Resources.dragType, String(index));
    event.dataTransfer?.setDragImage(this.blank, 0, 0);
  }

  protected follow(event: DragEvent, steps: HTMLElement): void {
    event.preventDefault();
    if (!Object.isNull(this.dragged()))
      this.liftTop.set(event.clientY - steps.getBoundingClientRect().top + steps.scrollTop - this.grab);
  }

  protected dragOver(event: DragEvent, index: number): void {
    if (Object.isNull(this.dragged()) || !(event.currentTarget instanceof HTMLElement))
      return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    this.dropAt.set(event.clientY < box.top + box.height / 2 ? index : index + 1);
  }

  protected drop(event: DragEvent): void {
    const from = this.dragged();
    const gap = this.dropAt();
    event.preventDefault();
    this.dragEnd();
    if (!Object.isNull(from) && !Object.isNull(gap))
      this.moveRow(from, gap > from ? gap - 1 : gap);
  }

  protected dragEnd(): void {
    this.dragged.set(null);
    this.dropAt.set(null);
    this.liftTop.set(null);
  }

  protected cancel(): void {
    GitRebasing.forget(this.instance());
    this.context.closeDocument(Resources.rebaseDocumentName, this.instance());
  }

  protected startRebase(start: GitRebaseStart): void {
    const updateRefs = this.moveStacked() && start.plan.stacked.length > 0;
    void this.state.rebaseAsync(start.target.id, this.planned().steps, updateRefs).then(ran => {
      if (ran)
        this.cancel();
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private moveRow(from: number, to: number): void {
    if (to < 0 || to >= this.rows().length || to === from)
      return;
    this.rows.update(t => GitRebaseRow.move(t, from, to));
    this.focusRow(to);
  }

  private focusRow(index: number): void {
    this.selected.set(index);
    afterNextRender(() => this.host.querySelector<HTMLElement>(`[data-row="${index}"]`)?.focus(), { injector: this.injector });
  }

  private static shortOf(id: string): string {
    return id.slice(0, Resources.shortIdLength);
  }

  private static checksOf(rows: readonly GitRebaseRow[], checks: readonly GitRebaseStepCheck[] | null, clean: string): IRowItem[] {
    let leader = "";
    return rows.map((row, index) => {
      if (!row.folds && row.action !== RebaseAction.Drop)
        leader = row.commit.id;
      return { row, check: GitRebaseComponent.checkOf(row, Object.isNull(checks) ? undefined : checks[index], leader, clean) };
    });
  }

  private static nameOf(row: GitRebaseRow | undefined): string | null {
    if (Object.isUndefined(row))
      return null;
    return row.folds ? Resources.formatTheFold(Resources.rebaseActionTitles[row.action]) : GitRebaseComponent.shortOf(row.commit.id);
  }

  private static distanceOf(place: number, index: number): number {
    return Math.abs(place - index) * 2 + Number(place < index);
  }

  private static changesFold(rows: readonly GitRebaseRow[], from: number, to: number): boolean {
    return [...rows.slice(from, from + 2), ...GitRebaseRow.move(rows, from, to).slice(to + 1, to + 2)].some(t => t.folds);
  }

  private static checkOf(row: GitRebaseRow, check: GitRebaseStepCheck | undefined, leader: string, clean: string): IRowCheck {
    if (row.action === RebaseAction.Drop)
      return { icon: Resources.checkIcons.Dropped, tone: Resources.mutedTone, text: Resources.leftOut };
    if (Object.isUndefined(check))
      return { icon: Resources.checkingIcon, tone: Resources.mutedTone, text: Resources.checkingLabel };
    switch (check.outcome) {
      case RebaseCheckOutcome.Conflicts:
        return { icon: Resources.checkIcons.Conflicts, tone: Resources.warningTone, text: Resources.formatConflictsIn(check.paths) };
      case RebaseCheckOutcome.Folded:
        return { icon: Resources.checkIcons.Folded, tone: Resources.mutedTone, text: Resources.formatFoldsInto(GitRebaseComponent.shortOf(leader)) };
      case RebaseCheckOutcome.Unavailable:
        return { icon: Resources.checkIcons.Unavailable, tone: Resources.mutedTone, text: Resources.notChecked };
      default:
        return { icon: Resources.checkIcons.Clean, tone: Resources.okTone, text: clean };
    }
  }

  private isCurrent(plan: GitRebasePlan, status: GitStatus): boolean {
    return plan.branch === status.branch && plan.commits.findLast(t => t.id === status.head) === plan.commits.at(-1);
  }

  private async readAsync(target: GitRebaseTarget | null): Promise<void> {
    const read = ++this.reads;
    this.plan.set(null);
    this.rows.set([]);
    this.readFailure.set(null);
    if (Object.isNull(target))
      return;
    try {
      const plan = await this.client.rebasePlanAsync(this.instance(), target.id);
      if (read !== this.reads)
        return;
      this.plan.set(plan);
      this.rows.set(GitRebaseRow.arrange(plan.commits, this.foldFixups()));
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      if (read === this.reads)
        this.readFailure.set(GitViewStateService.messageOf(error));
    }
  }

  private async checkDropAsync(drop: number, target: GitRebaseTarget, rows: readonly GitRebaseRow[]): Promise<void> {
    const answer = await this.askAsync(target, GitRebaseRow.planOf(rows).steps);
    if (drop === this.drops)
      this.landedChecks.set(answer);
  }

  private async adviseAsync(advice: number, target: GitRebaseTarget, rows: readonly GitRebaseRow[], stop: IGitRebaseStop): Promise<void> {
    const index = stop.step - 1;
    const places = rows.map((_, to) => to).filter(t => t !== index)
      .filter(t => GitRebaseRow.isValid(GitRebaseRow.move(rows, index, t)))
      .filter(t => !GitRebaseComponent.changesFold(rows, index, t))
      .sort((x, y) => GitRebaseComponent.distanceOf(x, index) - GitRebaseComponent.distanceOf(y, index))
      .slice(0, Resources.advicePlaces);
    for (const to of places) {
      const moved = GitRebaseRow.move(rows, index, to);
      const answer = await this.askAsync(target, GitRebaseRow.planOf(moved).steps);
      if (advice !== this.advices || answer.length !== moved.length)
        return;
      if (answer.every(t => t.outcome !== RebaseCheckOutcome.Conflicts)) {
        this.advice.set(Resources.formatDropAdvice(stop.commit, GitRebaseComponent.nameOf(moved[to - 1]), stop.paths));
        return;
      }
    }
  }

  private async checkAsync(target: GitRebaseTarget, steps: readonly RebaseStep[]): Promise<void> {
    const check = ++this.checks;
    this.stepChecks.set(null);
    const answer = await this.askAsync(target, steps);
    if (check === this.checks)
      this.stepChecks.set(answer);
  }

  private async askAsync(target: GitRebaseTarget, steps: readonly RebaseStep[]): Promise<readonly GitRebaseStepCheck[]> {
    try {
      return (await this.client.rebaseCheckAsync(this.instance(), target.id, steps)).steps;
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      return [];
    }
  }

  private run(work: Promise<unknown>): void {
    void work.catch((error: unknown) => this.errors.handleError(error));
  }
}
