/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, input, type InputSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { By } from "@angular/platform-browser";
import { LinkGesture, LinkReference, LinkReferenceChipComponent, LinkReferenceColor, LinkReferenceImage, LinkReferenceMatch, LinkReferenceState, LinkReferenceTone,
  LinkReferenceWorkItemState } from "@noldova/ui.components.angular";
import { describe, expect, it, onTestFinished } from "vitest";

import { GitReferenceTextComponent } from "../../../../src/app/components/git-reference-text/git-reference-text.component.ts";
import { GitLinkReferences } from "../../../../src/app/services/git-link-references.ts";

const FOLDER: string = "/work/site";
const ISSUE: string = "https://dev.azure.com/fabrikam/_workitems/edit/12";
const OTHER: string = "https://dev.azure.com/fabrikam/_workitems/edit/5";
const BUG: LinkReference = new LinkReference("Bug 12", "Bug", new LinkReferenceImage("data:,"));
const READ: LinkReference = new LinkReference("Bug 12", "Bug", new LinkReferenceImage("data:,"), {
  state: new LinkReferenceState("Bug", new LinkReferenceColor("#CC293D", "#FBE7E9"), new LinkReferenceColor("#F06B7A", "#3A1D21")),
  workItemState: new LinkReferenceWorkItemState("Active", new LinkReferenceTone("#007ACC", "#3794FF")),
  title: "Fix the login",
  itemHref: ISSUE
});

/** A list row as the Git view has one: the whole row is a click target, with the text in it. */
@Component({
  selector: "nol-git-reference-row",
  imports: [GitReferenceTextComponent],
  template: "<div class=\"row\" (click)=\"rowClicks = rowClicks + 1\"><nol-git-reference-text [text]=\"text()\" [folder]=\"folder\" [link]=\"link()\""
    + " [chipTabIndex]=\"chipTabIndex()\" /></div>"
})
class RowComponent {
  public readonly folder: string = FOLDER;
  public readonly text: InputSignal<string> = input<string>("Fixes AB#12 and #5");
  public readonly link: InputSignal<string | null> = input<string | null>(null);
  public readonly chipTabIndex: InputSignal<number | null> = input<number | null>(null);
  public rowClicks: number = 0;
}

class Row {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly errors: unknown[] = [];
  private handled: () => void = () => undefined;
  /** Settles once the error handler has a failure. */
  public readonly handledAsync: Promise<void> = new Promise(resolve => {
    this.handled = resolve;
  });
  public readonly opened: string[] = [];
  public readonly fixture: ComponentFixture<RowComponent>;

  public constructor(opens: (url: string) => boolean = () => false, inputs: Readonly<Record<string, unknown>> = {}, reference: LinkReference = BUG) {
    onTestFinished(GitLinkReferences.provide({
      referencesFor: folder => folder === FOLDER ? {
        find: t => t === ISSUE ? signal(reference) : null,
        findText: t => [new LinkReferenceMatch(t.indexOf("AB#12"), 5, ISSUE), new LinkReferenceMatch(t.indexOf("#5"), 2, OTHER)].filter(u => u.start >= 0)
      } : null,
      opens: (folder, url) => {
        this.opened.push(`${folder} ${url}`);
        return opens(url);
      }
    }));
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context },
      { provide: ErrorHandler, useValue: { handleError: (error: unknown) => {
        this.errors.push(error);
        this.handled();
      } } }] });
    this.fixture = TestBed.createComponent(RowComponent);
    for (const [name, value] of Object.entries(inputs))
      this.fixture.componentRef.setInput(name, value);
    this.fixture.autoDetectChanges();
  }

  public get links(): HTMLAnchorElement[] {
    return [...(this.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>("a")];
  }

  public get text(): string {
    return (this.fixture.nativeElement as HTMLElement).querySelector(".row")?.textContent ?? "";
  }

  public get rowClicks(): number {
    return this.fixture.componentInstance.rowClicks;
  }
}

describe("GitReferenceTextComponent", () => {
  it("shows a text's words, a reference its host has a look for as the kit's chip named as its host reads it, and one with none as a plain link", async () => {
    const row = new Row();
    await row.fixture.whenStable();

    expect([row.text, row.links.map(t => [t.matches("[nol-link-reference-chip]"), t.textContent, t.getAttribute("href"), t.getAttribute("tabindex")])])
      .toEqual(["Fixes Bug 12 and #5", [[true, "Bug 12", ISSUE, null], [false, "#5", OTHER, null]]]);
  });

  it("follows a chip with its title, keeps it out of the tab order when asked, and puts a work item's state after it, a space apart and outside the link", async () => {
    const row = new Row(() => false, { chipTabIndex: -1 }, READ);
    await row.fixture.whenStable();
    const state = (row.fixture.nativeElement as HTMLElement).querySelector("nol-link-reference-work-item-state");

    expect([row.text, row.links.map(t => t.textContent), state?.textContent, state?.closest("a"), state?.previousElementSibling?.matches("a[nol-link-reference-chip]"),
      row.links.map(t => t.getAttribute("tabindex"))]).toEqual(["Fixes Bug 12 · Fix the login Active and #5", ["Bug 12 · Fix the login", "#5"], "Active", null, true, ["-1", "-1"]]);
  });

  it("opens a link the chip's card activates as the chip's own, in the app when a host claims it, and the row doesn't take it", async () => {
    const row = new Row(() => true, {}, READ);
    await row.fixture.whenStable();
    const chip: LinkReferenceChipComponent = row.fixture.debugElement.query(By.directive(LinkReferenceChipComponent)).componentInstance;
    onTestFinished(() => chip.hide());

    chip.show();
    await row.fixture.whenStable();
    const title = [...document.querySelectorAll<HTMLAnchorElement>(`a[href="${ISSUE}"]`)].find(t => !t.matches("[nol-link-reference-chip]"));
    title?.click();

    expect([title === undefined, row.opened, row.context.callsOf("openLinkAsync"), row.rowClicks, chip.isShown]).toEqual([false, [`${FOLDER} ${ISSUE}`], [], 0, false]);
  });

  it("opens a clicked chip in the app when a host claims it, and the row it sits in doesn't take the click", async () => {
    const row = new Row(() => true);
    await row.fixture.whenStable();

    row.links[0]?.click();

    expect([row.opened, row.context.callsOf("openLinkAsync"), row.rowClicks]).toEqual([[`${FOLDER} ${ISSUE}`], [], 0]);
  });

  it("opens a reference no host claims in the browser, with the gesture that clicked it, once, while a click on its words reaches the row", async () => {
    const row = new Row();
    row.context.answer("openLinkAsync", async () => undefined);
    await row.fixture.whenStable();

    row.links[1]?.click();
    (row.fixture.nativeElement as HTMLElement).querySelector<HTMLElement>("span")?.click();

    expect([row.context.callsOf("openLinkAsync"), row.rowClicks]).toEqual([[[OTHER, { gesture: LinkGesture.Plain }]], 1]);
  });

  it("hands the window's failure to open a link to the error handler", async () => {
    const failure = new Error("No browser.");
    const row = new Row();
    row.context.answer("openLinkAsync", () => Promise.reject(failure));
    await row.fixture.whenStable();

    row.links[1]?.click();
    await row.handledAsync;

    expect(row.errors).toEqual([failure]);
  });

  it("links a whole text to the address it's given as one plain reference whose click the row takes, once, and takes it out of the tab order when asked", async () => {
    const row = new Row(() => true, { text: "!12", link: ISSUE, chipTabIndex: -1 });
    await row.fixture.whenStable();

    row.links[0]?.click();

    expect([row.links.map(t => [t.matches("[nol-link-reference-chip]"), t.textContent, t.getAttribute("href"), t.getAttribute("tabindex")]), row.opened,
      row.context.callsOf("openLinkAsync"), row.rowClicks]).toEqual([[[false, "Bug 12", ISSUE, "-1"]], [], [], 1]);
  });
});
