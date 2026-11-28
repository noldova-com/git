/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import type { HostAccountList } from "@noldova/git.hosting.protocol";

export class GitHubAccountList {
  private static readonly lists: WeakMap<IWindowPartContext, WritableSignal<HostAccountList | null>> = new WeakMap();

  public static of(context: IWindowPartContext): Signal<HostAccountList | null> {
    return GitHubAccountList.listOf(context).asReadonly();
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
