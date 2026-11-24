/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DialogRef } from "@angular/cdk/dialog";
import { ApplicationRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { DialogService } from "@noldova/ui.components.angular";
import { afterEach, describe, expect, it } from "vitest";

import { GitBulkPushDialogComponent } from "../../../../src/app/components/git-bulk-push-dialog/git-bulk-push-dialog.component.ts";
import { GitBulkTarget } from "../../../../src/app/models/git-bulk-target.ts";

const github: GitRemote = new GitRemote("origin", "github.com", "example-owner/ui", RemoteTransport.Https);
const opened: DialogRef<unknown, GitBulkPushDialogComponent>[] = [];

class Dialog {
  public readonly answers: boolean[] = [];
  private readonly host: HTMLElement;

  public constructor(branch: string, targets: readonly GitBulkTarget[]) {
    const dialog = TestBed.inject(DialogService).open(GitBulkPushDialogComponent, ".cancel");
    opened.push(dialog);
    dialog.componentRef?.setInput("branch", branch);
    dialog.componentRef?.setInput("targets", targets);
    dialog.componentInstance?.answered.subscribe(t => this.answers.push(t));
    const host: unknown = dialog.componentRef?.location.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new Error("The dialog didn't open.");
    this.host = host;
    TestBed.inject(ApplicationRef).tick();
  }

  public texts(selector: string): readonly string[] {
    return [...this.host.querySelectorAll(selector)].map(t => (t.textContent ?? "").trim());
  }

  public click(selector: string): void {
    const button = this.host.querySelector(selector);
    if (!(button instanceof HTMLButtonElement))
      throw new Error(`The dialog has no ${selector}.`);
    button.click();
  }
}

describe("GitBulkPushDialogComponent", () => {
  afterEach(() => {
    for (const dialog of opened.splice(0))
      dialog.close();
  });

  it("titles the push for the branch and lists each repository's push to its upstream, on its remote's place when it has one", () => {
    const dialog: Dialog = new Dialog("feature/kit", [new GitBulkTarget("/work/ui", "ui", "feature/kit", "origin/feature/kit", github),
      new GitBulkTarget("/work/notes", "notes", "feature/kit", "nas/feature/kit", null),
      new GitBulkTarget("/work/local", "local", "feature/kit", "origin/feature/kit", new GitRemote("origin", null, "srv/git/local", RemoteTransport.Ssh))]);

    expect([dialog.texts(".nol-dialog-title"), dialog.texts("li"), dialog.texts("button[nolDialogAction]")]).toEqual([["Push feature/kit?"],
      ["ui: feature/kit to origin/feature/kit on github.com/example-owner/ui", "notes: feature/kit to nas/feature/kit", "local: feature/kit to origin/feature/kit"],
      ["Push", "Cancel"]]);
    expect(dialog.texts(".text")[0]).toMatch(/^Each push sends the branch to its upstream/u);
  });

  it("says a repository whose branch has no upstream is skipped", () => {
    const dialog: Dialog = new Dialog("draft", [new GitBulkTarget("/work/git", "git", "draft", null, github)]);

    expect(dialog.texts("li")).toEqual(["git: skipped, since draft has no upstream on its remote"]);
  });

  it("answers true for Push and false for Cancel", () => {
    const dialog: Dialog = new Dialog("main", [new GitBulkTarget("/work/ui", "ui", "main", "origin/main", github)]);

    dialog.click(".push");
    dialog.click(".cancel");

    expect(dialog.answers).toEqual([true, false]);
  });
});
