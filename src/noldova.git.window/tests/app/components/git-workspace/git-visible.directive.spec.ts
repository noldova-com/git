/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { GitVisibleDirective } from "../../../../src/app/components/git-workspace/git-visible.directive.ts";
import { CountWaiter } from "../../../fixtures/count-waiter.fixture.ts";

@Component({
  imports: [GitVisibleDirective],
  template: `<div class="box" style="height: 10rem; overflow: auto">
    <div style="height: 30rem"></div>
    <div class="row" nolGitVisible style="height: 2rem" (visibleChange)="report($event)"></div>
    <div style="height: 30rem"></div>
  </div>`
})
class HostComponent {
  public readonly seen: boolean[] = [];
  private waiters: readonly CountWaiter[] = [];

  public reportsAsync(count: number): Promise<void> {
    if (this.seen.length >= count)
      return Promise.resolve();
    return new Promise(resolve => {
      this.waiters = [...this.waiters, new CountWaiter(count, resolve)];
    });
  }

  protected report(visible: boolean): void {
    this.seen.push(visible);
    for (const waiter of this.waiters.filter(t => t.count <= this.seen.length))
      waiter.resolve();
    this.waiters = this.waiters.filter(t => t.count > this.seen.length);
  }
}

describe("GitVisibleDirective", () => {
  const render = (): ComponentFixture<HostComponent> => {
    const fixture: ComponentFixture<HostComponent> = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
    return fixture;
  };

  const scrollToRow = (box: HTMLElement): void => {
    box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
  };

  it("reports its element out of view, then in view once scrolled to, then out again once scrolled past", async () => {
    const fixture: ComponentFixture<HostComponent> = render();
    const host: HostComponent = fixture.componentInstance;
    const box: HTMLElement = fixture.nativeElement.querySelector(".box");
    await host.reportsAsync(1);

    scrollToRow(box);
    await host.reportsAsync(2);
    box.scrollTop = box.scrollHeight;
    await host.reportsAsync(3);

    expect(host.seen).toEqual([false, true, false]);
  });

  it("reports nothing more once it's destroyed, though its element comes into view", async () => {
    const fixture: ComponentFixture<HostComponent> = render();
    const host: HostComponent = fixture.componentInstance;
    const box: HTMLElement = fixture.nativeElement.querySelector(".box");
    const row: HTMLElement = fixture.nativeElement.querySelector(".row");
    await host.reportsAsync(1);

    fixture.destroy();
    document.body.append(box);
    const shown: Promise<void> = new Promise(resolve => {
      const witness: IntersectionObserver = new IntersectionObserver(entries => {
        if (!entries.some(t => t.isIntersecting))
          return;
        witness.disconnect();
        resolve();
      });
      witness.observe(row);
    });
    scrollToRow(box);
    await shown;
    box.remove();

    expect(host.seen).toEqual([false]);
  });
});
