/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FakeWindowPartContext } from "@noldova/desktop.window/testing";

export class ContextCalls {
  private readonly counts: Map<string, number> = new Map();
  private readonly waiters: { readonly member: string; readonly count: number; readonly resolve: () => void }[] = [];

  public constructor(context: FakeWindowPartContext) {
    context.answer("setSettingsRows", () => this.called("setSettingsRows"));
    context.answer("log", () => this.called("log"));
  }

  public untilAsync(member: "setSettingsRows" | "log", count: number): Promise<void> {
    return this.countOf(member) >= count ? Promise.resolve() : new Promise<void>(resolve => {
      this.waiters.push({ member, count, resolve });
    });
  }

  private called(member: string): void {
    this.counts.set(member, this.countOf(member) + 1);
    for (const waiter of this.waiters.filter(t => t.member === member && t.count <= this.countOf(member))) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }

  private countOf(member: string): number {
    return this.counts.get(member) ?? 0;
  }
}
