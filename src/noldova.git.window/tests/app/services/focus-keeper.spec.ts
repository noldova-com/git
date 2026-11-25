/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { afterEach, describe, expect, it } from "vitest";

import { FocusKeeper } from "../../../src/app/services/focus-keeper.ts";

/** A rendered list whose focus the keeper keeps, and the function that stops it. */
class KeptList {
  public readonly root: HTMLElement;
  public readonly list: HTMLElement;
  public readonly stop: () => void;

  public constructor(root: HTMLElement, list: HTMLElement, stop: () => void) {
    this.root = root;
    this.list = list;
    this.stop = stop;
  }
}

describe("FocusKeeper", () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    roots.splice(0).forEach(t => t.remove());
  });

  const render = (rows: number): KeptList => {
    const root: HTMLElement = document.createElement("section");
    root.innerHTML = `<button type="button" class="head">Head</button><ul>${Array.from({ length: rows }, (_, at) =>
      `<li><button type="button" class="name">Name ${String(at)}</button><button type="button" class="move">Move ${String(at)}</button></li>`).join("")}</ul>`;
    document.body.append(root);
    roots.push(root);
    const list: HTMLElement | null = root.querySelector("ul");
    if (Object.isNull(list))
      throw new Error("No list.");
    return new KeptList(root, list, FocusKeeper.keep(root));
  };
  const press = (control: Element | undefined): void => {
    if (!(control instanceof HTMLElement))
      throw new Error("No control.");
    control.focus();
    control.click();
  };
  const settledAsync = (): Promise<void> => Promise.resolve();
  const focused = (): string => document.activeElement?.textContent ?? "";

  it("moves the focus to the control now at the pressed one's place, the next row's same button, once the pressed one's row goes", async () => {
    const { list } = render(3);
    const rows: HTMLElement[] = [...list.querySelectorAll("li")];
    press(rows[1]?.querySelector(".move") ?? undefined);

    list.append(document.createElement("li"));
    await settledAsync();
    const whileThere: string = focused();
    rows[1]?.remove();
    await settledAsync();

    expect([whileThere, focused()]).toEqual(["Move 1", "Move 2"]);
  });

  it("takes the last control of a container that has fewer, and an outer container's once the pressed one's container goes", async () => {
    const { list } = render(2);
    press(list.querySelectorAll("li")[1]?.querySelector(".move") ?? undefined);
    list.querySelectorAll("li")[1]?.remove();
    await settledAsync();
    const last: string = focused();

    press(list.querySelector(".name") ?? undefined);
    list.remove();
    await settledAsync();

    expect([last, focused()]).toEqual(["Move 0", "Head"]);
  });

  it("waits while nothing is left to take the focus, for the next state's first control, and leaves it alone once it moved on or when nothing in the root held it", async () => {
    const { root, list } = render(1);
    const outside: HTMLButtonElement = document.createElement("button");
    document.body.append(outside);
    roots.push(outside);

    press(root.querySelector(".head") ?? undefined);
    root.replaceChildren();
    await settledAsync();
    const nothingLeft: Element | null = document.activeElement;
    root.append(list);
    await settledAsync();
    const nextState: string = focused();

    press(list.querySelector(".move") ?? undefined);
    outside.focus();
    list.querySelector("li")?.remove();
    await settledAsync();
    const movedOn: Element | null = document.activeElement;

    list.click();
    root.replaceChildren();
    await settledAsync();

    expect([nothingLeft, nextState, movedOn, document.activeElement]).toEqual([document.body, "Name 0", outside, outside]);
  });

  it("passes over a disabled control, and takes it once it is enabled, as a new state's button is while its request ends", async () => {
    const { root } = render(0);
    const next: HTMLButtonElement = document.createElement("button");
    next.textContent = "Next";
    next.disabled = true;

    press(root.querySelector(".head") ?? undefined);
    root.replaceChildren(next);
    await settledAsync();
    const whileDisabled: Element | null = document.activeElement;
    next.disabled = false;
    await settledAsync();

    expect([whileDisabled, document.activeElement]).toEqual([document.body, next]);
  });

  it("reaches a button shown only while its row holds the focus through the row's control before it, and leaves the focus when none before it takes it", async () => {
    const { root, list } = render(3);
    const style: HTMLStyleElement = document.createElement("style");
    style.textContent = "li:not(:focus-within) > .move { visibility: hidden; }";
    root.append(style);
    const rows: HTMLElement[] = [...list.querySelectorAll("li")];
    press(rows[0]?.querySelector(".name") ?? undefined);
    press(rows[0]?.querySelector(".move") ?? undefined);
    rows[0]?.remove();
    await settledAsync();
    const shown: string = focused();

    style.textContent += " li .name { visibility: hidden; }";
    press(rows[1]?.querySelector(".move") ?? undefined);
    rows[1]?.remove();
    await settledAsync();

    expect([shown, document.activeElement]).toEqual(["Move 1", document.body]);
  });

  it("follows only the newest press, and nothing once stopped", async () => {
    const { list, stop } = render(3);
    const rows: HTMLElement[] = [...list.querySelectorAll("li")];
    press(rows[0]?.querySelector(".move") ?? undefined);
    press(rows[2]?.querySelector(".name") ?? undefined);
    rows[2]?.remove();
    await settledAsync();
    const newest: string = focused();
    press(rows[1]?.querySelector(".name") ?? undefined);
    stop();
    rows[0]?.remove();
    rows[1]?.remove();
    await settledAsync();

    expect([newest, document.activeElement]).toEqual(["Move 1", document.body]);
  });
});
