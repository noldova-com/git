/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, effect, ElementRef, ErrorHandler, inject, Injector, input, type InputSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { type GitRebasePlan, type GitRebaseStepCheck, OperationKind, RebaseAction, RebaseCheckOutcome, type RebaseStep } from "@noldova/git.protocol";
import { FormsModule } from "@angular/forms";
import { ButtonComponent, ButtonVariant, CheckboxComponent, SelectComponent, SelectOption, TextFieldComponent, ToolbarButtonComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import { GitRebasePreview, type IGitRebaseStop } from "../../models/git-rebase-preview.ts";
import { GitRebaseRow } from "../../models/git-rebase-row.ts";
import type { GitDetailView } from "../../services/git-detail-view.ts";
import { GitFolder } from "../../services/git-folder.ts";
import { GitRebasePreviews } from "../../services/git-rebase-previews.ts";
import { type GitRebaseTarget, GitRebasing } from "../../services/git-rebasing.ts";
import { GitRuntimeClient } from "../../services/git-runtime-client.ts";
import { GitViewOptions } from "../../services/git-view-options.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitReferenceTextComponent } from "../git-reference-text/git-reference-text.component.ts";

/** A row's check as the screen shows it: its icon, the icon's tone and the text. */
interface IRowCheck {
  readonly icon: string;
  readonly tone: string;
  readonly text: string;
}

/** A row with its check. */
interface IRowItem {
  readonly row: GitRebaseRow;
  readonly check: IRowCheck;
}

/**
 * An interactive rebase of a folder's current branch onto a commit, as a document: the branch's commits as rows to reorder by drag or Alt+↑ and Alt+↓, each
 * with its action and, for a reword or squash, its message; each row checked against the rows before it; and the options. The Rebase preview view
 * shows the branch after.
 */
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
  private drops = 0;
  private advices = 0;
  private readonly blank: HTMLImageElement = Object.assign(new Image(), { src: Resources.blankDragImage });
  /** How far below the dragged row's top the pointer took it. */
  private grab = 0;

  protected readonly resources: typeof Resources = Resources;
  /** Whether the app turned the module's AI features on, which shows its button. */
  protected readonly showsAiFeatures: Signal<boolean> = GitViewOptions.showsAiFeatures;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly actions: readonly SelectOption[] = Object.values(RebaseAction).map(t => new SelectOption(t, Resources.rebaseActionTitles[t]));
  protected readonly target: Signal<GitRebaseTarget | null> = computed(() => GitRebasing.targetOf(this.instance()));
  protected readonly plan: WritableSignal<GitRebasePlan | null> = signal<GitRebasePlan | null>(null);
  protected readonly readFailure: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly rows: WritableSignal<readonly GitRebaseRow[]> = signal<readonly GitRebaseRow[]>([]);
  protected readonly selected: WritableSignal<number> = signal(0);
  /** The row being dragged, and the gap it would drop into, before the row at that index. */
  protected readonly dragged: WritableSignal<number | null> = signal<number | null>(null);
  protected readonly dropAt: WritableSignal<number | null> = signal<number | null>(null);
  /** Where the dragged row's card floats, from the top of the steps' content, once the pointer moved over them. */
  protected readonly liftTop: WritableSignal<number | null> = signal<number | null>(null);
  /** Where the dragged row would land, by index, and the rows as they would be; `null` while no row is dragged. */
  protected readonly landing: Signal<{ readonly to: number; readonly rows: readonly GitRebaseRow[] } | null> = computed(() => {
    const from = this.dragged();
    const gap = this.dropAt();
    if (from === null)
      return null;
    const to = gap === null ? from : gap > from ? gap - 1 : gap;
    return { to, rows: to === from ? this.rows() : GitRebaseRow.move(this.rows(), from, to) };
  });
  /** Each row's check with the dragged row where it would land, while it matches; `null` while that check runs, and empty when git couldn't check. */
  protected readonly landedChecks: WritableSignal<readonly GitRebaseStepCheck[] | null> = signal<readonly GitRebaseStepCheck[] | null>(null);
  /** The dragged row with its check where it would drop, as the floating card shows it, or none before the pointer moves over the steps. */
  protected readonly lifted: Signal<readonly IRowItem[]> = computed(() => {
    const landing = this.landing();
    if (landing === null || this.liftTop() === null)
      return [];
    const items = GitRebaseRow.isValid(landing.rows)
      ? GitRebaseComponent.checksOf(landing.rows, landing.rows === this.rows() ? this.stepChecks() : this.landedChecks(), Resources.droppedClean)
      : landing.rows.map(row => ({ row, check: { icon: Resources.checkIcons.Unavailable, tone: Resources.warningTone, text: Resources.droppedRefused } }));
    return items.slice(landing.to, landing.to + 1).map(t => ({ row: t.row, check: { ...t.check, text: Resources.formatDroppedHere(t.check.text) } }));
  });
  /** Where to drop the row that stops on a conflict so that it applies cleanly, once a check found such a place; `null` until then. */
  protected readonly advice: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly moveStacked: WritableSignal<boolean> = signal(true);
  protected readonly foldFixups: WritableSignal<boolean> = signal(true);
  /** Each row's check, while it matches the rows; `null` while a check runs, and empty when git couldn't check. */
  protected readonly stepChecks: WritableSignal<readonly GitRebaseStepCheck[] | null> = signal<readonly GitRebaseStepCheck[] | null>(null);
  protected readonly planned: Signal<ReturnType<typeof GitRebaseRow.planOf>> = computed(() => GitRebaseRow.planOf(this.rows()));
  protected readonly valid: Signal<boolean> = computed(() => GitRebaseRow.isValid(this.rows()));
  /** Each row with its check. */
  protected readonly items: Signal<readonly IRowItem[]> = computed(() =>
    GitRebaseComponent.checksOf(this.rows(), this.stepChecks(), Resources.appliesCleanly));
  /** The first row that stops on a conflict, by index, with its paths and its commit's short id. */
  protected readonly stop: Signal<IGitRebaseStop | null> = computed(() => {
    const checks = this.stepChecks() ?? [];
    const found = checks.find(t => t.outcome === RebaseCheckOutcome.Conflicts);
    const index = found === undefined ? -1 : checks.indexOf(found);
    const row = this.rows().at(index);
    return found === undefined || row === undefined ? null : { step: index + 1, paths: found.paths, commit: GitRebaseComponent.shortOf(row.commit.id) };
  });
  /** The first conflicted file once a rebase in this folder really stopped on it; `null` while none has. */
  protected readonly stopped: Signal<string | null> = computed(() => {
    const status = this.state.folder() === this.instance() ? this.state.status() : null;
    if (status?.operation?.kind !== OperationKind.Rebase)
      return null;
    return status.entries.find(t => t.conflict !== null)?.path ?? null;
  });
  protected readonly ontoName: Signal<string> = computed(() => this.target()?.name ?? "");
  protected readonly heading: Signal<string> = computed(() => Resources.formatRebaseHeading(this.rows().length, this.plan()?.branch ?? null, this.ontoName()));
  /** The messages the branch's commits end with, newest first, as the Rebase preview view lists them. */
  protected readonly after: Signal<readonly string[]> = computed(() => this.planned().results.toReversed());
  protected readonly summary: Signal<string> = computed(() => {
    const summary = Resources.formatCommitsBecome(this.rows().length, this.planned().results.length);
    const advice = this.advice();
    return advice === null ? summary : Resources.formatWithAdvice(summary, advice);
  });
  /** What the Rebase preview view shows of this screen: the branch now and after, and the step that stops; `null` until the plan reads. */
  protected readonly preview: Signal<GitRebasePreview | null> = computed(() => {
    const plan = this.plan();
    return plan === null ? null : new GitRebasePreview(this.instance(), plan, this.ontoName(), this.rows().length, this.moveStacked() ? plan.stacked : [],
      this.after().map(t => this.subjectOf(t)), this.stop(), this.stopped());
  });
  /** What Start rebases onto and with, while the rows can run and the Git panel follows this folder with its status read; `null` holds Start. */
  protected readonly start: Signal<{ readonly target: GitRebaseTarget; readonly plan: GitRebasePlan } | null> = computed(() => {
    const target = this.target();
    const plan = this.plan();
    const ready = this.state.status() !== null && !this.state.busy() && this.rows().length > 0 && this.valid() && this.state.folder() === this.instance();
    return ready && target !== null && plan !== null ? { target, plan } : null;
  });

  /** The repository's folder; the document's instance. */
  public readonly instance: InputSignal<string> = input.required<string>();

  public constructor() {
    effect(() => {
      const target = this.target();
      untracked(() => this.run(this.readAsync(target)));
    });
    effect(() => {
      const steps = this.planned().steps;
      const target = this.target();
      if (target !== null && steps.length > 0 && this.valid())
        untracked(() => this.run(this.checkAsync(target, steps)));
    });
    effect(() => {
      const landing = this.landing();
      const target = this.target();
      const drop = ++this.drops;
      this.landedChecks.set(null);
      if (landing !== null && target !== null && landing.rows !== untracked(this.rows) && GitRebaseRow.isValid(landing.rows))
        untracked(() => this.run(this.checkDropAsync(drop, target, landing.rows)));
    });
    effect(() => {
      const stop = this.stop();
      const target = this.target();
      const dragging = this.dragged() !== null;
      const advice = ++this.advices;
      this.advice.set(null);
      if (stop !== null && target !== null && !dragging)
        untracked(() => this.run(this.adviseAsync(advice, target, this.rows(), stop)));
    });
    const active: Signal<boolean> = inject(WindowPartTokens.activeDocument);
    inject(DestroyRef).onDestroy(GitFolder.follow(this.instance, active));
    const previews: GitDetailView<GitRebasePreview> = GitRebasePreviews.of(this.context);
    previews.follow(this.preview, active, inject(Injector));
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

  /** Sets the row's action from the select's value, which is always one of the actions it lists. */
  protected setAction(index: number, action: string): void {
    const chosen = Object.values(RebaseAction).find(t => t === action);
    if (chosen !== undefined)
      this.rows.update(t => t.map((item, at) => at === index ? item.withAction(chosen) : item));
  }

  /** Sets the subject of a reword's or squash's message, keeping the body after it. */
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

  /** Alt+↑ and Alt+↓ move the row, ↑ and ↓ select the next one, and P, R, E, S, F and D set its action; keys typed into a message field are its own. */
  protected keydown(event: KeyboardEvent, index: number): void {
    if (event.target instanceof HTMLInputElement)
      return;
    const step = event.key === Resources.arrowUpKey ? -1 : event.key === Resources.arrowDownKey ? 1 : 0;
    const action = event.ctrlKey || event.metaKey || event.altKey ? undefined : Resources.rebaseActionKeys[event.key.toLowerCase()];
    if (step !== 0 && event.altKey)
      this.moveRow(index, index + step);
    else if (step !== 0)
      this.focusRow(Math.min(Math.max(index + step, 0), this.rows().length - 1));
    else if (action !== undefined)
      this.setAction(index, action);
    else
      return;
    event.preventDefault();
  }

  /** Takes a row up as a card that follows the pointer, hiding the browser's own picture of it. */
  protected dragStart(event: DragEvent, index: number, row: HTMLElement): void {
    this.dragged.set(index);
    this.liftTop.set(null);
    this.grab = event.clientY - row.getBoundingClientRect().top;
    event.dataTransfer?.setData(Resources.dragType, String(index));
    event.dataTransfer?.setDragImage(this.blank, 0, 0);
  }

  /** Moves the dragged row's card with the pointer, keeping the point it was taken by under it. */
  protected follow(event: DragEvent, steps: HTMLElement): void {
    event.preventDefault();
    if (this.dragged() !== null)
      this.liftTop.set(event.clientY - steps.getBoundingClientRect().top + steps.scrollTop - this.grab);
  }

  /** Marks the gap the dragged row would drop into: before this row in its upper half, else after it. */
  protected dragOver(event: DragEvent, index: number): void {
    if (this.dragged() === null || !(event.currentTarget instanceof HTMLElement))
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
    if (from !== null && gap !== null)
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

  /** Starts the rebase; the screen closes once git ran it, to its end or to an edit step, and stays with the failure shown when it couldn't. */
  protected startRebase(start: { readonly target: GitRebaseTarget; readonly plan: GitRebasePlan }): void {
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
    queueMicrotask(() => this.host.querySelector<HTMLElement>(`[data-row="${index}"]`)?.focus());
  }

  private static shortOf(id: string): string {
    return id.slice(0, Resources.shortIdLength);
  }

  /** Each row with its check from git's answer for the rows, with `clean` as the text of a clean one; a kept row without an answer is checking. */
  private static checksOf(rows: readonly GitRebaseRow[], checks: readonly GitRebaseStepCheck[] | null, clean: string): IRowItem[] {
    let leader = "";
    return rows.map((row, index) => {
      if (!row.folds && row.action !== RebaseAction.Drop)
        leader = row.commit.id;
      return { row, check: GitRebaseComponent.checkOf(row, checks === null ? undefined : checks[index], leader, clean) };
    });
  }

  /** How the advice names the row a dropped one would sit below: a fold by its action, any other by its short id; `null` for the top. */
  private static nameOf(row: GitRebaseRow | undefined): string | null {
    if (row === undefined)
      return null;
    return row.folds ? Resources.formatTheFold(Resources.rebaseActionTitles[row.action]) : GitRebaseComponent.shortOf(row.commit.id);
  }

  /** How far the advice ranks a place from the row's own: by rows, each place below the row just before the place as far above it. */
  private static distanceOf(place: number, index: number): number {
    return Math.abs(place - index) * 2 + Number(place < index);
  }

  /** Whether moving the row at `from` to `to` changes a fold: the row folds itself, it leaves a fold behind it, or it lands right above one. */
  private static changesFold(rows: readonly GitRebaseRow[], from: number, to: number): boolean {
    return [...rows.slice(from, from + 2), ...GitRebaseRow.move(rows, from, to).slice(to + 1, to + 2)].some(t => t.folds);
  }

  private static checkOf(row: GitRebaseRow, check: GitRebaseStepCheck | undefined, leader: string, clean: string): IRowCheck {
    if (row.action === RebaseAction.Drop)
      return { icon: Resources.checkIcons.Dropped, tone: Resources.mutedTone, text: Resources.leftOut };
    if (check === undefined)
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

  private async readAsync(target: GitRebaseTarget | null): Promise<void> {
    this.plan.set(null);
    this.rows.set([]);
    this.readFailure.set(null);
    if (target === null)
      return;
    try {
      const plan = await this.client.rebasePlanAsync(this.instance(), target.id);
      if (this.target() !== target)
        return;
      this.plan.set(plan);
      this.rows.set(GitRebaseRow.arrange(plan.commits, this.foldFixups()));
    }
    catch (error) {
      if (!GitRuntimeClient.isFailure(error))
        throw error;
      this.readFailure.set(GitViewStateService.messageOf(error));
    }
  }

  /** Checks the rows with the dragged row where it would drop, keeping the answer only while the pointer is still over that gap. */
  private async checkDropAsync(drop: number, target: GitRebaseTarget, rows: readonly GitRebaseRow[]): Promise<void> {
    const answer = await this.askAsync(target, GitRebaseRow.planOf(rows).steps);
    if (drop === this.drops)
      this.landedChecks.set(answer);
  }

  /**
   * Checks the row that stops on a conflict at the nearest other places, below before above, and names the first where nothing conflicts. It leaves out places
   * that change a fold or that git can't take, and stops once the rows change or a check fails.
   */
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

  /** Checks the steps, keeping the answer only while it is for the latest steps; a failure leaves the rows checking. */
  private async checkAsync(target: GitRebaseTarget, steps: readonly RebaseStep[]): Promise<void> {
    const check = ++this.checks;
    this.stepChecks.set(null);
    const answer = await this.askAsync(target, steps);
    if (check === this.checks)
      this.stepChecks.set(answer);
  }

  /** Git's check of each step, or none when git couldn't check them. */
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

  /** Runs the work, reporting a failure that isn't git's refusal. */
  private run(work: Promise<unknown>): void {
    void work.catch((error: unknown) => this.errors.handleError(error));
  }
}
