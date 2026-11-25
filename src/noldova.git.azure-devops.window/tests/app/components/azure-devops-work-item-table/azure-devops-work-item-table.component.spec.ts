/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { HostReference, HostWorkItem, HostWorkItemDetail, HostWorkItemType, WorkItemCategory } from "@noldova/git.hosting.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsWorkItemTableComponent } from "../../../../src/app/components/azure-devops-work-item-table/azure-devops-work-item-table.component.ts";
import { WorkItemRow } from "../../../../src/app/models/work-item-row.ts";

const REPOSITORY: string = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const feature: HostWorkItemType = new HostWorkItemType("Feature", "773B93", "icon_trophy");
const story: HostWorkItemType = new HostWorkItemType("User Story", "009CCC", "icon_book");

function detailOf(id: number, type: HostWorkItemType, title: string, iteration: string | null, children: readonly number[],
  pullRequests: readonly HostReference[], commits: number): HostWorkItemDetail {
  return new HostWorkItemDetail(new HostWorkItem("git-azure-devops", "fabrikam", "Sample Project", id, type, title, "Active", WorkItemCategory.InProgress,
    `https://dev.azure.com/fabrikam/Sample%20Project/_workitems/edit/${id}`, null, iteration, null, null), null, null, null, null, null, children, pullRequests,
  commits, []);
}

const parent: HostWorkItemDetail = detailOf(7490, feature, "Markdown export", null, [7521, 7522], [], 0);
const linked: HostWorkItemDetail = detailOf(7521, story, "Export notes as Markdown files", "Sample Project\\Sprint 17", [],
  [new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 752), new HostReference("git-azure-devops", "fabrikam", REPOSITORY, 479)], 3);
const committed: HostWorkItemDetail = detailOf(7522, story, "Send note digest emails", "Sample Project\\Sprint 17", [], [], 2);
const bare: HostWorkItemDetail = detailOf(7530, story, "Export preferences", null, [], [], 0);
const rows: readonly WorkItemRow[] = [new WorkItemRow(parent, 0), new WorkItemRow(linked, 1), new WorkItemRow(committed, 1), new WorkItemRow(bare, 0)];

function open(shown: readonly WorkItemRow[], selected: HostWorkItemDetail | null = null,
  context: FakeWindowPartContext = new FakeWindowPartContext()): ComponentFixture<AzureDevOpsWorkItemTableComponent> {
  TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  const fixture = TestBed.createComponent(AzureDevOpsWorkItemTableComponent);
  fixture.componentRef.setInput("rows", shown);
  fixture.componentRef.setInput("selected", selected);
  fixture.componentRef.setInput("label", "Work items");
  fixture.componentRef.setInput("empty", "No work items match.");
  fixture.detectChanges();
  return fixture;
}

function rowsOf(fixture: ComponentFixture<AzureDevOpsWorkItemTableComponent>): HTMLElement[] {
  const element: unknown = fixture.nativeElement;
  return element instanceof HTMLElement ? [...element.querySelectorAll<HTMLElement>(".wrow.item")] : [];
}

function cellsOf(row: HTMLElement): string[] {
  return [...row.querySelectorAll<HTMLElement>("[role=gridcell]")].slice(1).map(t => ((t.querySelector(".title-text") ?? t).textContent ?? "").trim());
}

describe("AzureDevOpsWorkItemTableComponent", () => {
  it("shows each row's id, title, state, iteration's last name and links: its first pull request, else its commits, else its children, else none", () => {
    const fixture = open(rows);

    expect(rowsOf(fixture).map(cellsOf)).toEqual([
      ["7490", "Markdown export", "Active", "—", "2 children"],
      ["7521", "Export notes as Markdown files", "Active", "Sprint 17", "!752"],
      ["7522", "Send note digest emails", "Active", "Sprint 17", "2 commits"],
      ["7530", "Export preferences", "Active", "—", "none"]
    ]);
  });

  it("shows a pull request as a chip and the other links as muted text", () => {
    const fixture = open(rows);

    expect(rowsOf(fixture).map(t => [!Object.isNull(t.querySelector(".links .chip")), !Object.isNull(t.querySelector(".links .muted"))]))
      .toEqual([[false, true], [true, false], [false, true], [false, true]]);
  });

  it("opens a chip's first pull request on a click, naming it, without choosing its row, and keeps Enter and Space on the chip from choosing it", () => {
    const context = new FakeWindowPartContext();
    const fixture = open(rows, null, context);
    const chosen: HostWorkItemDetail[] = [];
    fixture.componentInstance.chosen.subscribe(t => chosen.push(t));
    const chip = rowsOf(fixture)[1]?.querySelector<HTMLButtonElement>("button.chip");

    chip?.click();
    chip?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    chip?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

    expect([chip?.getAttribute("aria-label"), context.callsOf("openDocument"), chosen]).toEqual(["Open pull request !752",
      [["git-azure-devops.pullRequest", `fabrikam/${REPOSITORY}/752`, "!752"]], []]);
  });

  it("indents a title by its row's depth and draws its type's icon in its type's color", () => {
    const fixture = open(rows);
    const shown = rowsOf(fixture);

    expect([shown.map(t => t.querySelector<HTMLElement>(".cell-title")?.style.paddingLeft),
      shown.map(t => t.querySelector<HTMLElement>(".wi")?.style.color)]).toEqual([
      ["0rem", "1rem", "1rem", "0rem"],
      ["rgb(119, 59, 147)", "rgb(0, 156, 204)", "rgb(0, 156, 204)", "rgb(0, 156, 204)"]]);
  });

  it("draws a type's icon as Azure DevOps drew it, 0.875 of the symbol it stands in for and centred in the symbol's square, and the symbol when it drew none",
    () => {
    const svg: string = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#009CCC" d="M2 2h12v12H2z"/></svg>';
    const drawn: HostWorkItemDetail = detailOf(7540, new HostWorkItemType("User Story", "009CCC", "icon_book", svg), "Import notes", null, [], [], 0);
    const fixture = open([new WorkItemRow(drawn, 0), new WorkItemRow(bare, 0)]);
    const [imaged, plain] = rowsOf(fixture);
    const image = imaged?.querySelector<HTMLImageElement>("img.type-image");
    const imageBox = image?.getBoundingClientRect();
    const symbolBox = plain?.querySelector<HTMLElement>(".wi")?.getBoundingClientRect();

    expect([image?.getAttribute("src"), imaged?.querySelector("span.wi"), plain?.querySelector("img")]).toEqual([`data:image/svg+xml,${encodeURIComponent(svg)}`,
      null, null]);
    const size: number = (symbolBox?.width ?? 0) * 0.875;
    const inset: number = (symbolBox?.width ?? 0) * 0.0625;
    expect([imageBox?.width, imageBox?.height, imageBox?.left]).toEqual([size, size, (symbolBox?.left ?? 0) + inset]);
    expect(imageBox?.width).toBeGreaterThan(0);
  });

  it("marks only the chosen work item's row as selected, its title in the same weight as the others'", () => {
    const fixture = open(rows, linked);
    const weights: string[] = rowsOf(fixture).map(t => getComputedStyle(t.querySelector(".cell-title") ?? t).fontWeight);

    expect(rowsOf(fixture).map(t => [t.classList.contains("sel"), t.getAttribute("aria-selected")])).toEqual([
      [false, "false"], [true, "true"], [false, "false"], [false, "false"]]);
    expect(new Set(weights).size).toBe(1);
  });

  it("chooses a row's work item on a click, Enter or Space", () => {
    const fixture = open(rows);
    const chosen: HostWorkItemDetail[] = [];
    fixture.componentInstance.chosen.subscribe(t => chosen.push(t));
    const shown = rowsOf(fixture);

    shown[0]?.click();
    shown[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    shown[2]?.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    shown[3]?.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

    expect(chosen).toEqual([parent, linked, committed]);
  });

  it("gives each parent a chevron that collapses its children and expands them again, without choosing its row, every parent expanded at first", () => {
    const grandchild: HostWorkItemDetail = detailOf(7540, story, "Tagging", null, [], [], 0);
    const fixture = open([...rows.slice(0, 2), new WorkItemRow(grandchild, 2), ...rows.slice(2)]);
    const chosen: HostWorkItemDetail[] = [];
    fixture.componentInstance.chosen.subscribe(t => chosen.push(t));
    const ids = (): readonly string[] => rowsOf(fixture).map(t => t.querySelector(".id")?.textContent?.trim() ?? "");
    const toggles = (): readonly (readonly (string | null)[])[] => rowsOf(fixture).map(t => {
      const toggle = t.querySelector("button.toggle");
      return [t.getAttribute("aria-level"), t.getAttribute("aria-expanded"), toggle?.getAttribute("aria-label") ?? null, toggle?.textContent?.trim() ?? null];
    });
    const click = (id: string): void => {
      rowsOf(fixture).find(t => t.querySelector(".id")?.textContent?.trim() === id)?.querySelector<HTMLElement>("button.toggle")?.click();
      fixture.detectChanges();
    };

    const first = [ids(), toggles()];
    click("7521");
    const inner = ids();
    click("7490");
    const outer = [ids(), toggles()];
    click("7490");

    expect(first).toEqual([["7490", "7521", "7540", "7522", "7530"], [["1", "true", "Collapse Markdown export", "expand_more"],
      ["2", "true", "Collapse Export notes as Markdown files", "expand_more"], ["3", null, null, null], ["2", null, null, null], ["1", null, null, null]]]);
    expect([inner, outer, ids(), chosen]).toEqual([["7490", "7521", "7522", "7530"],
      [["7490", "7530"], [["1", "false", "Expand Markdown export", "chevron_right"], ["1", null, null, null]]], ["7490", "7521", "7522", "7530"], []]);
  });

  it("keeps Enter and Space on a chevron from choosing its row, and sets an empty 1.25rem space in place of a chevron on a row without children", () => {
    const fixture = open(rows);
    const chosen: HostWorkItemDetail[] = [];
    fixture.componentInstance.chosen.subscribe(t => chosen.push(t));
    const toggle = rowsOf(fixture)[0]?.querySelector<HTMLElement>("button.toggle");

    toggle?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    toggle?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    const spaces = rowsOf(fixture).map(t => t.querySelector<HTMLElement>(".toggle")?.getBoundingClientRect().width);
    const rem: number = parseFloat(getComputedStyle(document.documentElement).fontSize);

    expect([chosen, spaces.map(t => Math.round(t ?? 0)), rowsOf(fixture)[3]?.querySelector("span.toggle")?.getAttribute("aria-hidden")])
      .toEqual([[], [1.25, 1.25, 1.25, 1.25].map(t => Math.round(t * rem)), "true"]);
  });

  it("names the grid by its label and says the empty text when it has no rows", () => {
    const fixture = open([]);
    const element: unknown = fixture.nativeElement;
    const grid = element instanceof HTMLElement ? element.querySelector("[role=grid]") : null;

    expect([grid?.getAttribute("aria-label"), rowsOf(fixture).length, grid?.querySelector(".empty")?.textContent?.trim()])
      .toEqual(["Work items", 0, "No work items match."]);
  });
});
