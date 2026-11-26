/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, type EnvironmentProviders, Injector, type Provider, type Signal, signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitCommitDetailViewComponent } from "../../src/app/components/git-commit-detail-view/git-commit-detail-view.component.ts";
import { GitViewComponent } from "../../src/app/components/git-view/git-view.component.ts";
import { GitCommitDetails } from "../../src/app/services/git-commit-details.ts";
import { GitViewStateService } from "../../src/app/services/git-view-state.service.ts";
import { GitViewing } from "../../src/app/services/git-viewing.ts";
import { GitFixtures } from "./git-fixtures.fixture.ts";

export class GitViewFixture {
  public readonly context: FakeWindowPartContext;
  public readonly fixture: ComponentFixture<object>;
  public readonly folder: WritableSignal<string | null>;
  public readonly panel: HTMLElement;

  private constructor(context: FakeWindowPartContext, fixture: ComponentFixture<object>, folder: WritableSignal<string | null>, panel: HTMLElement) {
    this.context = context;
    this.fixture = fixture;
    this.folder = folder;
    this.panel = panel;
  }

  public get element(): HTMLElement {
    return this.fixture.nativeElement;
  }

  public get state(): GitViewStateService {
    return this.fixture.debugElement.injector.get(GitViewStateService);
  }

  public static async renderAsync(answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>, selector: string = ".body",
    providers: readonly (Provider | EnvironmentProviders)[] = []): Promise<GitViewFixture> {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, answers);
    const folder: WritableSignal<string | null> = GitFixtures.setUp(context, providers);
    const fixture: ComponentFixture<GitViewComponent> = TestBed.createComponent(GitViewComponent);
    fixture.autoDetectChanges();
    const view: GitViewFixture = new GitViewFixture(context, fixture, folder, fixture.nativeElement);
    await view.waitForAsync(selector);
    return view;
  }

  public static async renderCommitAsync(answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>, selector: string = ".detail",
    providers: readonly (Provider | EnvironmentProviders)[] = [], active: Signal<boolean> = signal(true)): Promise<GitViewFixture> {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, answers);
    const folder: WritableSignal<string | null> = GitFixtures.setUp(context, providers);
    GitCommitDetails.of(context).follow(computed(() => GitViewing.commitOf(folder())), active, TestBed.inject(Injector));
    const panel: ComponentFixture<GitViewComponent> = TestBed.createComponent(GitViewComponent);
    panel.autoDetectChanges();
    const fixture: ComponentFixture<GitCommitDetailViewComponent> = TestBed.createComponent(GitCommitDetailViewComponent);
    fixture.componentRef.setInput("instance", "selected");
    fixture.autoDetectChanges();
    document.body.append(panel.nativeElement);
    const view: GitViewFixture = new GitViewFixture(context, fixture, folder, panel.nativeElement);
    await view.waitForAsync(selector);
    return view;
  }

  public find<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found: T | null = this.element.querySelector<T>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  }

  public all(selector: string): readonly HTMLElement[] {
    return [...this.element.querySelectorAll<HTMLElement>(selector)];
  }

  public texts(selector: string): readonly string[] {
    return this.all(selector).map(t => (t.textContent ?? "").replace(/\s+/gu, " ").trim());
  }

  public waitForAsync(selector: string): Promise<void> {
    return this.untilAsync(() => !Object.isNull(this.element.querySelector(selector)));
  }

  public untilAsync(done: () => boolean): Promise<void> {
    if (done())
      return Promise.resolve();
    return new Promise(resolve => {
      const observer: MutationObserver = new MutationObserver(() => {
        if (!done())
          return;
        observer.disconnect();
        resolve();
      });
      observer.observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
    });
  }

  public async clickAsync(selector: string): Promise<void> {
    this.find(selector).click();
    await this.fixture.whenStable();
  }

  public async chooseAsync(trigger: string, label: string): Promise<void> {
    const rows = (): readonly HTMLElement[] => [...document.querySelectorAll<HTMLElement>("button[nol-menu-item]")];
    await this.clickAsync(trigger);
    await this.untilAsync(() => rows().length > 0);
    const row: HTMLElement | undefined = rows().find(t => t.textContent?.includes(label) === true);
    if (Object.isUndefined(row))
      throw new Error(`No menu row reads ${label}.`);
    row.click();
    await this.untilAsync(() => rows().length === 0);
    await this.fixture.whenStable();
  }

  public requested(method: string): readonly unknown[] {
    return this.context.callsOf("requestAsync").filter(t => t[0] === method).map(t => t[1]);
  }
}
