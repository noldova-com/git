/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type Signal, signal, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { HostAccountList } from "@noldova/git.hosting.protocol";

export class GitHubAccountList {
  private static readonly lists: WeakMap<IWindowPartContext, WritableSignal<HostAccountList | null>> = new WeakMap();
  private static readonly gitHubLists: WeakMap<IWindowPartContext, Signal<HostAccountList | null>> = new WeakMap();

  public static of(context: IWindowPartContext): Signal<HostAccountList | null> {
    const known: Signal<HostAccountList | null> | undefined = GitHubAccountList.gitHubLists.get(context);
    if (!Object.isUndefined(known))
      return known;
    const all: Signal<HostAccountList | null> = GitHubAccountList.listOf(context);
    const gitHub: Signal<HostAccountList | null> = computed(() => {
      const list: HostAccountList | null = all();
      return Object.isNull(list) ? null : GitHubAccountList.gitHubOf(list);
    });
    GitHubAccountList.gitHubLists.set(context, gitHub);
    return gitHub;
  }

  public static allOf(context: IWindowPartContext): Signal<HostAccountList | null> {
    return GitHubAccountList.listOf(context).asReadonly();
  }

  public static gitHubOf(list: HostAccountList): HostAccountList {
    return new HostAccountList(list.accounts.filter(t => Object.isNull(t.host)));
  }

  public static show(context: IWindowPartContext, list: HostAccountList | null): void {
    GitHubAccountList.listOf(context).set(list);
  }

  private static listOf(context: IWindowPartContext): WritableSignal<HostAccountList | null> {
    const known: WritableSignal<HostAccountList | null> | undefined = GitHubAccountList.lists.get(context);
    if (!Object.isUndefined(known))
      return known;
    const list: WritableSignal<HostAccountList | null> = signal<HostAccountList | null>(null);
    GitHubAccountList.lists.set(context, list);
    return list;
  }
}
