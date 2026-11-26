/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { GitAgentsComponent } from "../../../../src/app/components/git-agents/git-agents.component.ts";
import { GitAgentState } from "../../../../src/app/enums/git-agent-state.ts";
import type { IGitAgents } from "../../../../src/app/interfaces/i-git-agents.ts";
import { GitAgentRow } from "../../../../src/app/models/git-agent-row.ts";
import { GitAgents } from "../../../../src/app/services/git-agents.ts";

describe("GitAgentsComponent", () => {
  interface IMounted {
    readonly fixture: ComponentFixture<GitAgentsComponent>;
    readonly element: HTMLElement;
    readonly handled: unknown[];
  }

  const provide = (runs: WritableSignal<readonly GitAgentRow[] | null>, opened: string[] = [], member: Partial<IGitAgents> = {}): void => {
    onTestFinished(GitAgents.provide({ listFor: () => runs, open: (folder, row) => opened.push(`${folder} ${row.key}`), ...member }));
  };
  const mount = async (): Promise<IMounted> => {
    const handled: unknown[] = [];
    vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(error => handled.push(error));
    const fixture: ComponentFixture<GitAgentsComponent> = TestBed.createComponent(GitAgentsComponent);
    fixture.componentRef.setInput("folder", "/work/site");
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement, handled };
  };
  const texts = (element: HTMLElement, selector: string): string[] => [...element.querySelectorAll(selector)].map(t =>
    (t.children.length === 0 ? [t] : [...t.children]).map(u => (u.textContent ?? "").trim()).filter(u => u.length > 0).join(" "));
  const rem = (pixels: number): number => pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
  const blameGutter: GitAgentRow = new GitAgentRow("run-1", "Blame gutter", GitAgentState.Working, "/work/site-agents/blame");
  const flakyTest: GitAgentRow = new GitAgentRow("run-2", "Flaky watch test", GitAgentState.WaitingForYou, "/work/site-agents/flaky");

  it("lists each run with the robot, its name and its state's icon, the header counting their worktrees, in the panel's row geometry", async () => {
    provide(signal([blameGutter, flakyTest, new GitAgentRow("run-3", "Docs", GitAgentState.Done, "/work/site-agents/flaky"),
      new GitAgentRow("run-4", "Lint", GitAgentState.Failed, "/work/site-agents/lint")]));
    const mounted: IMounted = await mount();
    const row: DOMRect = mounted.element.querySelector(".run")?.getBoundingClientRect() ?? new DOMRect();
    const robot: DOMRect = mounted.element.querySelector(".run .agent")?.getBoundingClientRect() ?? new DOMRect();
    const name: DOMRect = mounted.element.querySelector(".run .name")?.getBoundingClientRect() ?? new DOMRect();
    const state: DOMRect = mounted.element.querySelector(".run .state")?.getBoundingClientRect() ?? new DOMRect();
    const states: Element[] = [...mounted.element.querySelectorAll(".run .state")];

    expect([texts(mounted.element, ".section .toggle"), texts(mounted.element, ".section .worktrees")]).toEqual([["keyboard_arrow_down Agents"], ["3 worktrees"]]);
    expect(texts(mounted.element, ".run")).toEqual([
      "smart_toy Blame gutter progress_activity", "smart_toy Flaky watch test pan_tool", "smart_toy Docs check_circle", "smart_toy Lint error"
    ]);
    expect(states.map(t => [[...t.classList].sort().join(" "), t.getAttribute("aria-label")])).toEqual([
      ["Working ms state", "Working"], ["WaitingForYou ms state", "Waiting for you"], ["Done ms state", "Done"], ["Failed ms state", "Failed"]
    ]);
    expect(mounted.element.querySelector(".run")?.getAttribute("title")).toBe("/work/site-agents/blame");
    expect([rem(row.height), rem(robot.width), rem(robot.left - row.left), rem(name.left - row.left), rem(row.right - state.right), rem(state.width)])
      .toEqual([1.625, 1, 0.5, 1.875, 0.5, 1]);
  });

  it("folds the section closed and open, says one worktree in the singular, and says so when no agent works there", async () => {
    const runs: WritableSignal<readonly GitAgentRow[] | null> = signal([blameGutter]);
    provide(runs);
    const mounted: IMounted = await mount();
    const header: string[] = texts(mounted.element, ".section .worktrees");
    mounted.element.querySelector<HTMLElement>(".toggle")?.click();
    await mounted.fixture.whenStable();
    const folded: string[] = [mounted.element.querySelector(".toggle")?.getAttribute("aria-expanded") ?? "", String(mounted.element.querySelectorAll(".run").length)];
    mounted.element.querySelector<HTMLElement>(".toggle")?.click();
    runs.set(null);
    await mounted.fixture.whenStable();

    expect([header, folded, texts(mounted.element, ".note"), texts(mounted.element, ".section .worktrees")]).toEqual([
      ["1 worktree"], ["false", "0"], ["No agents work in this repository"], []
    ]);
  });

  it("shows nothing while no module gives runs, and lists every provider's runs together, passing over one whose list throws", async () => {
    const mounted: IMounted = await mount();
    const empty: number = mounted.element.childElementCount;
    provide(signal([blameGutter]));
    provide(signal(null), [], { listFor: () => { throw new RangeError("No runs."); } });
    provide(signal([flakyTest]));
    await mounted.fixture.whenStable();

    expect([empty, texts(mounted.element, ".run .name"), mounted.handled.map(String)]).toEqual([0, ["Blame gutter", "Flaky watch test"], ["RangeError: No runs."]]);
  });

  it("opens a run through the provider that listed it, and reports an open that throws", async () => {
    const opened: string[] = [];
    provide(signal([blameGutter]), opened);
    provide(signal([flakyTest]), [], { open: () => { throw new RangeError("Gone."); } });
    const mounted: IMounted = await mount();
    for (const row of mounted.element.querySelectorAll<HTMLElement>(".run"))
      row.click();
    await mounted.fixture.whenStable();

    expect([opened, mounted.handled.map(String)]).toEqual([["/work/site run-1"], ["RangeError: Gone."]]);
  });
});
