/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, DestroyRef, effect, type Injector, linkedSignal, type Signal, signal, untracked, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { GitDetailFront } from "../models/git-detail-front.ts";
import { GitDetailPage } from "../models/git-detail-page.ts";

export class GitDetailView<T> {
  private readonly context: IWindowPartContext;
  private readonly view: string;
  private readonly instance: string;
  private readonly titleOf: (choice: T) => string;
  private readonly isBroughtForward: boolean;
  private readonly pages: WritableSignal<readonly GitDetailPage<T>[]> = signal([]);
  private readonly opened: WritableSignal<boolean> = signal<boolean>(false);
  private lastOpened: T | null = null;

  public readonly front: Signal<T | null | undefined> = computed(() => this.pages().find(t => t.active())?.choice());

  public readonly shown: Signal<T | null> = linkedSignal<GitDetailFront<T>, T | null>({
    source: (): GitDetailFront<T> => new GitDetailFront(this.front(), this.pages().length > 0),
    computation: (source, previous): T | null => {
      if (!source.isFollowing)
        return null;
      return Object.isUndefined(source.front) ? previous?.value ?? null : source.front;
    }
  });

  public readonly isOpen: Signal<boolean> = this.opened.asReadonly();

  public constructor(context: IWindowPartContext, view: string, instance: string, titleOf: (choice: T) => string, isBroughtForward: boolean = true) {
    this.context = context;
    this.view = view;
    this.instance = instance;
    this.titleOf = titleOf;
    this.isBroughtForward = isBroughtForward;
  }

  public follow(choice: Signal<T | null>, active: Signal<boolean>, injector: Injector): void {
    const page: GitDetailPage<T> = new GitDetailPage(choice, active);
    this.pages.update(t => [...t, page]);
    injector.get(DestroyRef).onDestroy(() => this.pages.update(t => t.filter(u => u !== page)));
    let wasShowing: boolean = false;
    let wasActive: boolean = false;
    effect(() => {
      const isActive: boolean = active();
      const chosen: T | null = choice();
      const isShowing: boolean = isActive && !Object.isNull(chosen);
      untracked(() => {
        if (wasActive && !isActive)
          this.lastOpened = null;
        if (isShowing && !wasShowing && !Object.isNull(chosen) && chosen !== this.lastOpened && this.isBroughtForward)
          this.open(chosen);
        else if (wasActive && !isActive && this.opened() && Object.isUndefined(this.front()))
          this.context.returnView(this.view, this.instance);
      });
      wasShowing = isShowing;
      wasActive = isActive;
    }, { injector });
  }

  public showInFront(choice: T): void {
    this.open(choice);
  }

  public bringForward(): void {
    const front: T | null | undefined = this.front();
    if (!Object.isNullOrUndefined(front))
      this.open(front);
  }

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
