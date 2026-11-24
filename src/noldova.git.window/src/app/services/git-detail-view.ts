/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, DestroyRef, effect, type Injector, linkedSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";

/** A detail view beside the documents that shows what the active document of its kind chose, such as a work item or a conflict. */
export class GitDetailView<T> {
  private readonly context: IWindowPartContext;
  private readonly view: string;
  private readonly instance: string;
  private readonly titleOf: (choice: T) => string;
  private readonly pages: WritableSignal<readonly (readonly [Signal<T | null>, Signal<boolean>])[]> = signal([]);
  private isShown: boolean = false;
  private isReturned: boolean = false;
  private isFrontAsked: boolean = false;
  /** The followed document that was in front when the view was asked forward, `null` until one is; another one coming to the front ends the ask. */
  private askedPage: readonly [Signal<T | null>, Signal<boolean>] | null = null;
  private readonly opened: WritableSignal<boolean> = signal<boolean>(false);

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

  public constructor(context: IWindowPartContext, view: string, instance: string, titleOf: (choice: T) => string) {
    this.context = context;
    this.view = view;
    this.instance = instance;
    this.titleOf = titleOf;
  }

  /**
   * Adds a document's choice, with whether it is the window's active document, until the document's injector is destroyed; while the view is open,
   * the person leaving the followed documents gives its group's front back with `returnView`, and coming back to one brings the view forward again.
   */
  public follow(choice: Signal<T | null>, active: Signal<boolean>, injector: Injector): void {
    const page: readonly [Signal<T | null>, Signal<boolean>] = [choice, active];
    this.pages.update(t => [...t, page]);
    injector.get(DestroyRef).onDestroy(() => this.pages.update(t => t.filter(u => u !== page)));
    let wasActive: boolean = untracked(active);
    if (wasActive)
      this.cameToFront(page);
    effect(() => {
      const isActive = active();
      untracked(() => this.turned(page, wasActive, isActive));
      wasActive = isActive;
    }, { injector });
  }

  /** Opens the view the first time a document in front shows a choice, leaving the focus where it is; later, the person's choice of tab stays. */
  public showOnce(choice: T): void {
    if (!this.isShown || this.isFrontAsked)
      this.open(choice);
  }

  /** Opens the view, leaving the focus where it is, when the person chose while it is closed; while it is open, its tab stays where it is. */
  public showChosen(choice: T): void {
    if (!this.opened())
      this.open(choice);
  }

  /** Opens the view, leaving the focus where it is, or brings its tab to the front of its group while it is open, for a choice the person made. */
  public showInFront(choice: T): void {
    this.open(choice);
  }

  /**
   * Brings the view to the front of its group, leaving the focus where it is: at once while the followed document in front shows a choice, else at the
   * next choice that document, or the next one to come to the front, shows, until another followed document comes to the front.
   */
  public bringForward(): void {
    const front: T | null | undefined = this.front();
    if (front !== undefined && front !== null) {
      this.open(front);
      return;
    }
    this.isFrontAsked = true;
    this.askedPage = this.pages().find(t => t[1]()) ?? null;
  }

  /** Follows the person closing the view, so their next choice opens it again; returns the function that stops following. */
  public listen(): () => void {
    return this.context.onViewClosed(this.view, instance => {
      if (instance === this.instance)
        this.opened.set(false);
    });
  }

  private turned(page: readonly [Signal<T | null>, Signal<boolean>], wasActive: boolean, isActive: boolean): void {
    if (isActive && !wasActive)
      this.cameToFront(page);
    if (!this.opened() || wasActive === isActive)
      return;
    if (!isActive && this.front() === undefined) {
      this.isReturned = true;
      this.context.returnView(this.view, this.instance);
      return;
    }
    const shown = this.shown();
    if (isActive && this.isReturned && shown !== null)
      this.open(shown);
  }

  /** Ties an ask to bring the view forward to the first followed document in front after it, and ends it when another one comes to the front. */
  private cameToFront(page: readonly [Signal<T | null>, Signal<boolean>]): void {
    if (!this.isFrontAsked)
      return;
    if (this.askedPage === null)
      this.askedPage = page;
    else if (this.askedPage !== page)
      this.isFrontAsked = false;
  }

  private open(choice: T): void {
    this.isShown = true;
    this.isReturned = false;
    this.isFrontAsked = false;
    this.askedPage = null;
    this.opened.set(true);
    this.context.openView(this.view, this.instance, this.titleOf(choice));
  }
}
