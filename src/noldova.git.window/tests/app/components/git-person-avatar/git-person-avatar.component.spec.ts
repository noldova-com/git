/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { HostReference } from "@noldova/git.hosting.protocol";
import { AvatarSize, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";

import { GitPersonAvatarComponent } from "../../../../src/app/components/git-person-avatar/git-person-avatar.component.ts";
import { TestPullRequestHost } from "../../../fixtures/test-pull-request-host.fixture.ts";

const picture: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const given: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

@Component({
  selector: "nol-git-people",
  imports: [GitPersonAvatarComponent],
  template: `<div class="list">
    <nol-git-person-avatar class="mona" [host]="host" [reference]="reference" login="monalisa@fabrikam.test" [size]="small" />
    <nol-git-person-avatar class="given" [host]="host" [reference]="reference" login="hubot@fabrikam.test" [image]="given" />
    <div class="gap"></div>
    <nol-git-person-avatar class="below" [host]="host" [reference]="reference" login="octocat@fabrikam.test" />
  </div>`,
  styles: [".list { display: flex; flex-direction: column; height: 10rem; overflow: auto; } .gap { flex: none; height: 50rem; }"]
})
class PeopleComponent {
  public static host: TestPullRequestHost = new TestPullRequestHost();
  protected readonly host: TestPullRequestHost = PeopleComponent.host;
  protected readonly reference: HostReference = new HostReference("git-example", "fabrikam", "site", 752);
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly given: string = given;
}

function imageOf(root: HTMLElement, selector: string): string | null {
  return root.querySelector(`${selector} img`)?.getAttribute("src") ?? null;
}

function untilAsync(done: () => boolean): Promise<void> {
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

async function openAsync(): Promise<ComponentFixture<PeopleComponent>> {
  AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
  PeopleComponent.host = new TestPullRequestHost();
  PeopleComponent.host.avatar = picture;
  const fixture = TestBed.createComponent(PeopleComponent);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture;
}

describe("GitPersonAvatarComponent", () => {
  afterEach(() => {
    AppearanceFixture.reset();
  });

  it("asks the host for the picture of each person in view, for the pull request they're on, and none for a picture the page already has", async () => {
    const root: HTMLElement = (await openAsync()).nativeElement;

    await untilAsync(() => !Object.isNull(imageOf(root, ".mona")));

    expect([imageOf(root, ".mona"), imageOf(root, ".given"), imageOf(root, ".below"), [...new Set(PeopleComponent.host.askedPeople)]])
      .toEqual([picture, given, null, ["fabrikam/monalisa@fabrikam.test"]]);
  });

  it("asks for a person's picture once they're scrolled into view, showing their initials until then", async () => {
    const root: HTMLElement = (await openAsync()).nativeElement;
    await untilAsync(() => !Object.isNull(imageOf(root, ".mona")));
    const initials: boolean = !Object.isNull(root.querySelector(".below .nol-avatar-initials"));

    root.querySelector(".below")?.scrollIntoView();

    await untilAsync(() => !Object.isNull(imageOf(root, ".below")));
    expect([initials, imageOf(root, ".below"), [...new Set(PeopleComponent.host.askedPeople)]])
      .toEqual([true, picture, ["fabrikam/monalisa@fabrikam.test", "fabrikam/octocat@fabrikam.test"]]);
  });
});
