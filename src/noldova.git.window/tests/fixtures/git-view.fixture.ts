/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider, WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitViewComponent } from "../../src/app/components/git-view/git-view.component.ts";
import { GitViewStateService } from "../../src/app/services/git-view-state.service.ts";
import { GitFixtures } from "./git-fixtures.fixture.ts";

export class GitViewFixture {
  public readonly context: FakeWindowPartContext;
  public readonly fixture: ComponentFixture<GitViewComponent>;
  public readonly folder: WritableSignal<string | null>;

  private constructor(context: FakeWindowPartContext, fixture: ComponentFixture<GitViewComponent>, folder: WritableSignal<string | null>) {
    this.context = context;
    this.fixture = fixture;
    this.folder = folder;
  }

  public get element(): HTMLElement {
    return this.fixture.nativeElement;
  }

  public get state(): GitViewStateService {
    return this.fixture.debugElement.injector.get(GitViewStateService);
  }

  public static async renderAsync(answers: Readonly<Record<string, JsonValue | Error | (() => JsonValue | Error)>>, selector: string = ".body",
    providers: readonly Provider[] = []): Promise<GitViewFixture> {
    const context: FakeWindowPartContext = new FakeWindowPartContext();
    GitFixtures.answerWith(context, answers);
    const folder: WritableSignal<string | null> = GitFixtures.setUp(context, providers);
    const fixture: ComponentFixture<GitViewComponent> = TestBed.createComponent(GitViewComponent);
    fixture.autoDetectChanges();
    const view: GitViewFixture = new GitViewFixture(context, fixture, folder);
    await view.waitForAsync(selector);
    return view;
  }

  public find<T extends HTMLElement = HTMLElement>(selector: string): T {
    const found: T | null = this.element.querySelector<T>(selector);
    if (found === null)
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
    return this.untilAsync(() => this.element.querySelector(selector) !== null);
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

  public requested(method: string): readonly unknown[] {
    return this.context.callsOf("requestAsync").filter(t => t[0] === method).map(t => t[1]);
  }
}
