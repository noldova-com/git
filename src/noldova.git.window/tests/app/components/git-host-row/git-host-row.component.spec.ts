/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject, input, type InputSignal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitHostRowComponent } from "../../../../src/app/components/git-host-row/git-host-row.component.ts";
import { GitHostRows } from "../../../../src/app/services/git-host-rows.ts";
import { GitFixtures } from "../../../fixtures/git-fixtures.fixture.ts";
import { GitViewFixture } from "../../../fixtures/git-view.fixture.ts";

@Component({
  selector: "nol-git-test-host-row",
  template: "<p class=\"host\">{{ folder() }} {{ branch() }} {{ head() }} {{ remote().path }}</p>"
})
class TestHostRowComponent {
  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly branch: InputSignal<string | null> = input.required<string | null>();
  public readonly head: InputSignal<string | null> = input.required<string | null>();
  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();
}

@Component({
  selector: "nol-git-test-context-row",
  template: "<p class=\"context\"></p>"
})
class ContextRowComponent {
  public static readonly made: ContextRowComponent[] = [];
  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly branch: InputSignal<string | null> = input.required<string | null>();
  public readonly head: InputSignal<string | null> = input.required<string | null>();
  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();
  public readonly context: IWindowPartContext = inject(WindowPartTokens.context);

  public constructor() {
    ContextRowComponent.made.push(this);
  }
}

describe("GitHostRowComponent", () => {
  it("gives the row its providing module's context, not the Git view's, and keeps the row for a new but equal remote", async () => {
    const host: FakeWindowPartContext = new FakeWindowPartContext();
    const git: FakeWindowPartContext = new FakeWindowPartContext();
    onTestFinished(GitHostRows.provide(host, { claims: t => t.host === "github.com", component: ContextRowComponent }));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: git }] });
    ContextRowComponent.made.length = 0;
    const fixture = TestBed.createComponent(GitHostRowComponent);
    const remote = (): GitRemote => new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    fixture.componentRef.setInput("folder", GitFixtures.folder);
    fixture.componentRef.setInput("status", GitFixtures.status([], null, { remote: remote() }));
    fixture.componentRef.setInput("remote", remote());
    fixture.autoDetectChanges();
    await fixture.whenStable();
    fixture.componentRef.setInput("remote", remote());
    await fixture.whenStable();

    expect(ContextRowComponent.made).toHaveLength(1);
    expect(ContextRowComponent.made[0]?.context).toBe(host);
    expect(fixture.nativeElement.querySelectorAll(".context")).toHaveLength(1);
  });

  it("renders the row that claims the remote, with the folder, branch, head and remote", async () => {
    onTestFinished(GitHostRows.provide(new FakeWindowPartContext(), { claims: t => t.host === "github.com", component: TestHostRowComponent }));
    const remote: GitRemote = new GitRemote("origin", "github.com", "example-owner/example-repository", RemoteTransport.Https);
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { remote }).toJson() }, ".host");

    expect(view.texts(".host")).toEqual(["/work/project main 0123456789abcdef0123456789abcdef01234567 example-owner/example-repository"]);
    expect(view.all(".plain")).toHaveLength(0);
  });

  it.each([
    [new GitRemote("nas", "nas.home", "notes", RemoteTransport.Ssh), "nas is a plain Git server (nas.home over SSH): no pull requests or checks to show."],
    [new GitRemote("mirror", "git.example", "a/b", RemoteTransport.Https), "mirror is a plain Git server (git.example over HTTPS): no pull requests or checks to show."],
    [new GitRemote("backup", null, "srv/backup", RemoteTransport.File), "backup is a plain Git server (srv/backup over a file path): no pull requests or checks to show."],
    [new GitRemote("odd", null, null, RemoteTransport.Other), "odd is a plain Git server (odd over its own transport): no pull requests or checks to show."]
  ])("shows the plain line for a remote no row claims", async (remote, line) => {
    const view: GitViewFixture = await GitViewFixture.renderAsync({ ...GitFixtures.watching, "git.status": GitFixtures.status([], null, { remote }).toJson() }, ".plain");

    expect([...view.texts(".plain .material-symbols-rounded"), ...view.texts(".plain-text")]).toEqual(["dns", line]);
  });
});
