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
import { WindowPartTokens } from "@noldova/desktop.window";
import { HostAvatar, PersonQuery } from "@noldova/git.hosting.protocol";
import { AvatarSize, DefaultTheme, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it } from "vitest";

import { AzureDevOpsPersonAvatarComponent } from "../../../../src/app/components/azure-devops-person-avatar/azure-devops-person-avatar.component.ts";
import { AzureDevOpsAuthorAvatars } from "../../../../src/app/services/azure-devops-author-avatars.ts";
import { ReferenceContext } from "../../../fixtures/reference-context.fixture.ts";
import { Wait } from "../../../fixtures/wait.fixture.ts";

const picture: string = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

@Component({
  selector: "nol-git-azure-devops-people",
  imports: [AzureDevOpsPersonAvatarComponent],
  template: `<div class="list">
    <nol-git-azure-devops-person-avatar class="mona" organization="fabrikam" login="monalisa@fabrikam.com" name="monalisa" [size]="small" />
    <nol-git-azure-devops-person-avatar class="mona-again" organization="Fabrikam" login="MonaLisa@Fabrikam.com" name="monalisa" [size]="small" />
    <nol-git-azure-devops-person-avatar class="given" organization="fabrikam" login="hubot@fabrikam.com" name="hubot" [image]="picture" />
    <div class="gap"></div>
    <nol-git-azure-devops-person-avatar class="below" organization="fabrikam" login="octocat@fabrikam.com" name="octocat" />
  </div>`,
  styles: [".list { display: flex; flex-direction: column; height: 10rem; overflow: auto; } .gap { flex: none; height: 50rem; }"]
})
class PeopleComponent {
  protected readonly small: AvatarSize = AvatarSize.Small;
  protected readonly picture: string = picture;
}

describe("AzureDevOpsPersonAvatarComponent", () => {
  let context: ReferenceContext;

  const askedLogins = (): readonly string[] => context.requests.filter(t => t.method === "git-azure-devops.readPersonAvatar")
    .map(t => PersonQuery.fromJson(t.parameters).login);
  const imageOf = (root: HTMLElement, selector: string): string | null => root.querySelector(`${selector} img`)?.getAttribute("src") ?? null;

  async function openAsync(): Promise<ComponentFixture<PeopleComponent>> {
    AppearanceFixture.apply(DefaultTheme.theme, ThemeMode.Light);
    context = new ReferenceContext().answerModule("git-azure-devops.readPersonAvatar", () => new HostAvatar(picture).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(PeopleComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => {
    AzureDevOpsAuthorAvatars.release(context);
    TestBed.resetTestingModule();
  });

  it("reads the picture of each person in view once, however often they're shown, and none for a picture the page already has", async () => {
    const fixture = await openAsync();
    const root: HTMLElement = fixture.nativeElement;

    await Wait.until(() => expect([imageOf(root, ".mona"), imageOf(root, ".mona-again")]).toEqual([picture, picture]));

    expect([askedLogins(), imageOf(root, ".given"), imageOf(root, ".below")]).toEqual([["monalisa@fabrikam.com"], picture, null]);
  });

  it("reads a person's picture once they're scrolled into view, showing their initials until then", async () => {
    const fixture = await openAsync();
    const root: HTMLElement = fixture.nativeElement;
    await Wait.until(() => expect(askedLogins()).toEqual(["monalisa@fabrikam.com"]));
    const initials: boolean = !Object.isNull(root.querySelector(".below .nol-avatar-initials"));

    root.querySelector(".below")?.scrollIntoView();

    await Wait.until(() => expect(imageOf(root, ".below")).toBe(picture));
    expect([initials, askedLogins()]).toEqual([true, ["monalisa@fabrikam.com", "octocat@fabrikam.com"]]);
  });
});
