/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, DestroyRef, effect, type Injector, linkedSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";

/**
 * A detail view beside the documents that shows what the active document of its kind chose, such as a work item or a conflict. One rule brings it to the
 * front of its group: a followed document coming to the front with a choice, or showing its first one while in front, and a choice the person makes; a
 * read again that keeps a choice moves nothing, and the focus always stays where it is.
 */
export class GitDetailView<T> {
  private readonly context: IWindowPartContext;
  private readonly view: string;
  private readonly instance: string;
  private readonly titleOf: (choice: T) => string;
  private readonly isBroughtForward: boolean;
  private readonly pages: WritableSignal<readonly (readonly [Signal<T | null>, Signal<boolean>])[]> = signal([]);
  private readonly opened: WritableSignal<boolean> = signal<boolean>(false);
  /** The choice the view last opened for while its document stayed in front, so a document showing the one the person just chose doesn't open it twice. */
  private lastOpened: T | null = null;

  /** The choice of the followed document that is the window's active document: `undefined` while none is, `null` while it has nothing chosen. */
  public readonly front: Signal<T | null | undefined> = computed(() => this.pages().find(t => t[1]())?.[0]());

  /** What the view shows: the front choice, kept while a document of another kind is in front; `null` once no followed document is open. */
  public readonly shown: Signal<T | null> = linkedSignal({
    source: (): { readonly front: T | null | undefined; readonly isFollowing: boolean } => ({ front: this.front(), isFollowing: this.pages().length > 0 }),
    computation: (source: { readonly front: T | null | undefined; readonly isFollowing: boolean }, previous?: { value: T | null }): T | null => {
      if (!source.isFollowing)
        return null;
      return source.front === undefined ? previous?.value ?? null : source.front;
    }
  });

  /** Whether the view is open since a choice opened it: `false` before, and once the person closed it, which `listen` hears. */
  public readonly isOpen: Signal<boolean> = this.opened.asReadonly();

  /**
   * @param isBroughtForward Whether a followed document coming to the front brings the view forward; false for a view that stays where the person put it,
   * which only `showInFront` and `bringForward` open.
   */
  public constructor(context: IWindowPartContext, view: string, instance: string, titleOf: (choice: T) => string, isBroughtForward: boolean = true) {
    this.context = context;
    this.view = view;
    this.instance = instance;
    this.titleOf = titleOf;
    this.isBroughtForward = isBroughtForward;
  }

  /**
   * Adds a document's choice, with whether it is the window's active document, until the document's injector is destroyed. The document coming to the
   * front with a choice, or showing its first choice while in front, brings the view forward; while the view is open, the person leaving the followed
   * documents for another kind gives its group's front back with `returnView`.
   */
  public follow(choice: Signal<T | null>, active: Signal<boolean>, injector: Injector): void {
    const page: readonly [Signal<T | null>, Signal<boolean>] = [choice, active];
    this.pages.update(t => [...t, page]);
    injector.get(DestroyRef).onDestroy(() => this.pages.update(t => t.filter(u => u !== page)));
    let wasShowing: boolean = false;
    let wasActive: boolean = false;
    effect(() => {
      const isActive: boolean = active();
      const chosen: T | null = choice();
      const isShowing: boolean = isActive && chosen !== null;
      untracked(() => {
        if (wasActive && !isActive)
          this.lastOpened = null;
        if (isShowing && !wasShowing && chosen !== null && chosen !== this.lastOpened && this.isBroughtForward)
          this.open(chosen);
        else if (wasActive && !isActive && this.opened() && this.front() === undefined)
          this.context.returnView(this.view, this.instance);
      });
      wasShowing = isShowing;
      wasActive = isActive;
    }, { injector });
  }

  /** Opens the view, or brings its tab to the front of its group while it is open, retitled, for a choice the person made. */
  public showInFront(choice: T): void {
    this.open(choice);
  }

  /** Brings the view to the front of its group for the followed document in front's choice; with none, the next one in front with a choice brings it. */
  public bringForward(): void {
    const front: T | null | undefined = this.front();
    if (front !== undefined && front !== null)
      this.open(front);
  }

  /** Follows the person closing the view; returns the function that stops following. */
  public listen(): () => void {
    return this.context.onViewClosed(this.view, instance => {
      if (instance === this.instance)
        this.opened.set(false);
    });
  }

  private open(choice: T): void {
    this.lastOpened = choice;
    this.opened.set(true);
    this.context.openView(this.view, this.instance, this.titleOf(choice));
  }
}
