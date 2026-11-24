/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { GitHubNames } from "@noldova/git.github.protocol";
import { DeviceCode, HostAccount, HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
import { ClipboardWriter } from "@noldova/ui.components.angular";
import { ClipboardWriterFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GitHubSignInComponent } from "../../../../src/app/components/github-sign-in/github-sign-in.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const NOW: number = 1_800_000_000_000;
const code: DeviceCode = new DeviceCode("WDJB-MJHT", "https://github.com/login/device", NOW + 872_000);
const account: HostAccount = new HostAccount("example-user", null, null, ["repo"]);
const picture: string = "data:image/png;base64,iVBORw0KGgo=";

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly browser = { placeFor: (): LinkPlace => LinkPlace.InApp, openAsync: (): Promise<void> => Promise.resolve() };
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<GitHubSignInComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get clipboard(): string[] {
    const writer = TestBed.inject(ClipboardWriter);
    return writer instanceof ClipboardWriterFixture ? writer.texts : [];
  }

  public get logs(): readonly unknown[] {
    return this.context.callsOf("log").map(t => t[0]);
  }

  public get links(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync").map(t => t[0]);
  }

  public get places(): readonly unknown[] {
    return this.context.callsOf("openLinkAsync").map(t => {
      const options = t[1];
      return typeof options === "object" && options !== null && "place" in options ? options.place : this.browser.placeFor();
    });
  }

  public registerInAppBrowser(): void {
    this.context.registerInAppBrowser(this.browser);
  }

  public refuseClipboard(): void {
    const writer = TestBed.inject(ClipboardWriter);
    if (writer instanceof ClipboardWriterFixture)
      writer.answer = (): Promise<boolean> => Promise.resolve(false);
  }

  public async openAsync(first: HostSignIn | null): Promise<this> {
    if (first !== null)
      this.requests.answer(GitHubNames.readSignInMethod, first.toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(GitHubSignInComponent);
    await this.settleAsync();
    return this;
  }

  public async settleAsync(): Promise<void> {
    await this.fixture?.whenStable();
    this.fixture?.detectChanges();
    await this.fixture?.whenStable();
  }

  public texts(selector: string): string[] {
    return [...this.element.querySelectorAll(selector)].map(t => (t.textContent ?? "").replace(/\s+/g, " ").trim());
  }

  public labels(): string[] {
    return this.texts("button .nol-button-label");
  }

  public button(label: string): HTMLButtonElement {
    const found = [...this.element.querySelectorAll("button")].find(t => (t.textContent ?? "").includes(label));
    if (found === undefined)
      throw new Error(`No button reads ${label}.`);
    return found;
  }

  public async clickAsync(label: string): Promise<void> {
    this.button(label).click();
    await this.settleAsync();
  }
}

describe("GitHubSignInComponent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the sign-in when it opens and offers a sign-in with what it brings", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());

    expect(page.requests.methods).toEqual([GitHubNames.readSignInMethod]);
    expect([...page.texts("h3, p"), ...page.labels()]).toEqual(["Account",
      "Sign in to see pull requests, their checks, and issue and pull request links in replies. Git works without it.", "Sign in to GitHub"]);
    expect(page.element.querySelector("[role=alert]")).toBeNull();
  });

  it("says the sign-in can't be read, logs why, and reads it again on Try again", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.readSignInMethod, new WindowFailure("Not connected."));
    await page.openAsync(null);
    const failed = [...page.texts("h3, [role=alert] .nol-git-github-banner-text > span"), ...page.labels()];
    page.requests.answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await page.clickAsync("Try again");

    expect(failed).toEqual(["Account", "GitHub's sign-in didn't answer.", "Try again; the app's log has the details.", "Try again"]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.readSignInMethod} request failed: WindowFailure: Not connected.`]);
    expect([page.element.querySelector("[role=alert]"), page.labels(), page.requests.methods])
      .toEqual([null, ["Sign in to GitHub"], [GitHubNames.readSignInMethod, GitHubNames.readSignInMethod]]);
  });

  it("passes on a failure of the sign-in's read that isn't the window's, rather than saying GitHub's sign-in didn't answer", async () => {
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(GitHubNames.readSignInMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();
    await page.openAsync(null);

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("logs a failed read that a newer sign-in change overtook, but shows the newer account without saying the read didn't answer", async () => {
    const page = new Page();
    const reject = page.requests.holdFailure(GitHubNames.readSignInMethod);
    const opening = page.openAsync(null);
    await page.requests.askedAsync(1);
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    reject(new WindowFailure("Not connected."));
    await opening;

    expect([page.element.querySelector("[role=alert]"), page.texts(".nol-git-github-strong")]).toEqual([null, ["example-user"]]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.readSignInMethod} request failed: WindowFailure: Not connected.`]);
  });

  it("names why the last sign-in ended, in place of what a sign-in brings", async () => {
    const shown: (string | boolean)[][] = [];
    for (const failure of Object.values(SignInFailure)) {
      const page = await new Page().openAsync(HostSignIn.signedOut(failure));
      shown.push([...page.texts("[role=alert] span span"), page.element.querySelector("p") === null]);
      TestBed.resetTestingModule();
    }

    expect(shown).toEqual([
      ["The code expired before it was entered.", "Sign in again for a new code.", true],
      ["The sign-in was refused on GitHub.", "Sign in again to approve Noldova.", true],
      ["GitHub no longer accepts this computer's sign-in.", "Sign in again to restore it.", true],
      ["GitHub couldn't be reached.", "Check the connection, then sign in again.", true],
      ["GitHub's answer couldn't be used.", "Sign in again; the app's log has the details.", true],
      ["This computer couldn't keep the sign-in.", "Sign in again; the app's log has the details.", true],
      ["This computer couldn't remove the sign-in.", "The app may sign in with it when it next starts; the app's log has the details.", true]
    ]);
  });

  it("starts a sign-in, shows its code, copies it and opens GitHub's page in the system's browser while the in-app browser takes other links, and copies or opens it again", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.registerInAppBrowser();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    const onClipboardAtOpen: string[][] = [];
    page.context.answer("openLinkAsync", async () => {
      onClipboardAtOpen.push([...page.clipboard]);
    });

    await page.clickAsync("Sign in to GitHub");
    await page.clickAsync("Copy code");
    await page.clickAsync("Open the page again");

    expect(page.requests.methods).toEqual([GitHubNames.readSignInMethod, GitHubNames.startSignInMethod]);
    expect(page.texts("p, .nol-git-github-code, [role=timer]")).toEqual(["Paste the code WDJB-MJHT on GitHub's page; it's copied.", "WDJB-MJHT",
      "Waiting for GitHub. The code expires in 14:32."]);
    expect([page.links, page.clipboard]).toEqual([["https://github.com/login/device", "https://github.com/login/device"],
      ["WDJB-MJHT", "WDJB-MJHT", "WDJB-MJHT"]]);
    expect(onClipboardAtOpen).toEqual([["WDJB-MJHT"], ["WDJB-MJHT", "WDJB-MJHT", "WDJB-MJHT"]]);
    expect(page.places).toEqual([LinkPlace.System, LinkPlace.System]);
  });

  it("says a code is copied only while it is the code the clipboard took, not for a newer one started elsewhere", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.clickAsync("Sign in to GitHub");
    const copied = page.texts("p")[0];

    const other = new DeviceCode("QXRT-PLMN", code.verificationUri, code.expiresAt);
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.waiting(other).toJson());
    await page.settleAsync();

    expect([copied, page.texts("p")[0]]).toEqual(["Paste the code WDJB-MJHT on GitHub's page; it's copied.",
      "Enter this code at github.com/login/device."]);
  });

  it("still opens GitHub's page when the clipboard refuses the code, and asks the person to enter it instead of saying it's copied", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.refuseClipboard();
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    page.context.answer("openLinkAsync", async () => undefined);

    await page.clickAsync("Sign in to GitHub");

    expect([page.texts("p")[0], page.links, page.clipboard]).toEqual(["Enter this code at github.com/login/device.", ["https://github.com/login/device"],
      ["WDJB-MJHT"]]);
  });

  it("counts down to the code's expiry each second, never below zero, and stops counting once it no longer waits", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] });
    const page = await new Page().openAsync(HostSignIn.waiting(code));

    vi.advanceTimersByTime(1_000);
    await page.settleAsync();
    const second = page.texts("[role=timer]");
    vi.advanceTimersByTime(900_000);
    await page.settleAsync();
    const expired = page.texts("[role=timer]");
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut(SignInFailure.Expired).toJson());
    await page.settleAsync();

    expect([second, expired]).toEqual([["Waiting for GitHub. The code expires in 14:31."], ["Waiting for GitHub. The code expires in 0:00."]]);
    expect([vi.getTimerCount(), page.texts("[role=alert] .nol-git-github-strong")]).toEqual([0, ["The code expired before it was entered."]]);
  });

  it("moves the focus to the next state's first button when Try again, Sign in, Cancel or Sign out goes as it is used, never to the page", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.readSignInMethod, new WindowFailure("Not connected."));
    await page.openAsync(null);
    page.context.answer("openLinkAsync", async () => undefined);
    const pressAsync = async (label: string, next: string): Promise<boolean> => {
      page.button(label).focus();
      await page.clickAsync(label);
      return document.activeElement === page.button(next);
    };

    page.requests.answer(GitHubNames.readSignInMethod, HostSignIn.signedOut().toJson());
    const afterTryAgain = await pressAsync("Try again", "Sign in to GitHub");
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.waiting(code).toJson());
    const afterSignIn = await pressAsync("Sign in to GitHub", "Copy code");
    page.requests.answer(GitHubNames.cancelSignInMethod, HostSignIn.signedOut().toJson());
    const afterCancel = await pressAsync("Cancel", "Sign in to GitHub");
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    await page.settleAsync();
    page.requests.answer(GitHubNames.signOutMethod, HostSignIn.signedOut().toJson());
    const afterSignOut = await pressAsync("Sign out", "Sign in to GitHub");

    expect([afterTryAgain, afterSignIn, afterCancel, afterSignOut]).toEqual([true, true, true, true]);
  });

  it("cancels a waiting sign-in", async () => {
    const page = await new Page().openAsync(HostSignIn.waiting(code));
    page.requests.answer(GitHubNames.cancelSignInMethod, HostSignIn.signedOut().toJson());

    await page.clickAsync("Cancel");

    expect([page.requests.methods.at(-1), page.labels()]).toEqual([GitHubNames.cancelSignInMethod, ["Sign in to GitHub"]]);
  });

  it("shows the account and its access, signs out, and opens GitHub's page for the app's access in the system's browser while the in-app browser takes other links", async () => {
    const page = await new Page().openAsync(HostSignIn.signedIn(account));
    page.registerInAppBrowser();
    const shown = [...page.texts(".nol-git-github-account-text > span"), page.element.querySelector("nol-avatar")?.textContent?.trim()];
    page.requests.answer(GitHubNames.signOutMethod, HostSignIn.signedOut().toJson());
    page.context.answer("openLinkAsync", async () => undefined);

    await page.clickAsync("Manage access on GitHub");
    await page.clickAsync("Sign out");

    expect(shown).toEqual(["example-user", "Signed in on this computer · access to your repositories", "E"]);
    expect([page.links, page.requests.methods.at(-1), page.labels()]).toEqual([[GitHubNames.manageAccessUrl], GitHubNames.signOutMethod, ["Sign in to GitHub"]]);
    expect(page.places).toEqual([LinkPlace.System]);
  });

  it("tints the account's avatar from its login, so each person keeps their own color", async () => {
    const page = await new Page().openAsync(HostSignIn.signedIn(account));
    const fillOf = (): string => {
      const avatar = page.element.querySelector("nol-avatar");
      return avatar instanceof HTMLElement ? avatar.style.getPropertyValue("--nol-avatar-fill") : "";
    };

    const showAsync = async (login: string, avatar: string | null): Promise<string> => {
      page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(new HostAccount(login, null, avatar, ["repo"])).toJson());
      await page.settleAsync();
      return fillOf();
    };

    const first = fillOf();
    const otherLogin = await showAsync("other-user", account.avatar);
    const otherPicture = await showAsync(account.login, picture);

    expect(first).not.toBe("");
    expect([otherLogin === first, otherPicture]).toEqual([false, first]);
  });

  it("says when the account gave no access to the repositories", async () => {
    const page = await new Page().openAsync(HostSignIn.signedIn(new HostAccount("other-user", null, null, [])));

    expect(page.texts(".nol-git-github-label")).toEqual(["Signed in on this computer · no access to your repositories"]);
  });

  it("drops a sign-in answer that a newer sign-in change overtook", async () => {
    const page = new Page();
    const release = page.requests.hold(GitHubNames.readSignInMethod);
    const asked = page.requests.askedAsync(1);

    const opening = page.openAsync(null);
    await asked;
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    release(HostSignIn.signedOut().toJson());
    await opening;

    expect([page.texts(".nol-git-github-strong"), page.labels()]).toEqual([["example-user"], ["Sign out", "Manage access on GitHub"]]);
  });

  it("follows the sign-in's changes until it closes", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());

    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    await page.settleAsync();
    const shown = page.texts(".nol-git-github-strong");
    const following = page.context.activeCallsOf("onEvent").filter(t => t[0] === GitHubNames.signInChangedEvent).length;
    page.fixture?.destroy();

    expect([shown, following, page.context.activeCallsOf("onEvent").filter(t => t[0] === GitHubNames.signInChangedEvent).length]).toEqual([["example-user"], 1, 0]);
  });

  it("holds its buttons while a request is out, and keeps the page as it was when the request fails, saying so", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const release = page.requests.hold(GitHubNames.startSignInMethod);

    page.button("Sign in to GitHub").click();
    await Promise.resolve();
    page.fixture?.detectChanges();
    const held = [page.button("Sign in to GitHub").disabled, page.element.querySelector("section")?.getAttribute("aria-busy")];
    release(HostSignIn.signedOut(SignInFailure.Unreachable).toJson());
    await page.settleAsync();
    page.requests.fail(GitHubNames.startSignInMethod, new WindowFailure("Not connected."));
    await page.clickAsync("Sign in to GitHub");

    expect(held).toEqual([true, "true"]);
    expect([page.button("Sign in to GitHub").disabled, page.texts("[role=alert] .nol-git-github-strong"), page.links])
      .toEqual([false, ["GitHub couldn't be reached.", "GitHub's sign-in didn't answer."], []]);
    expect(page.logs).toEqual([`The GitHub module's ${GitHubNames.startSignInMethod} request failed: WindowFailure: Not connected.`]);
  });

  it("opens no page for a start that answers a sign-in that doesn't wait", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.answer(GitHubNames.startSignInMethod, HostSignIn.signedIn(account).toJson());

    await page.clickAsync("Sign in to GitHub");

    expect([page.links, page.texts(".nol-git-github-strong")]).toEqual([[], ["example-user"]]);
  });

  it("keeps the code shown when GitHub's page can't open, and says and logs that it didn't", async () => {
    const page = await new Page().openAsync(HostSignIn.waiting(code));
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });

    await page.clickAsync("Open the page again");

    expect([page.links, page.texts(".nol-git-github-code")]).toEqual([["https://github.com/login/device"], ["WDJB-MJHT"]]);
    expect(page.texts("[role=alert] .nol-git-github-strong")).toEqual(["The page couldn't be opened."]);
    expect(page.logs).toEqual(["The GitHub module couldn't open https://github.com/login/device: WindowFailure: No browser."]);
  });

  it("passes on a failure to open GitHub's page that isn't the window's, rather than saying the page couldn't be opened", async () => {
    const page = await new Page().openAsync(HostSignIn.waiting(code));
    const unexpected = new TypeError("Unexpected.");
    page.context.answer("openLinkAsync", async () => {
      throw unexpected;
    });
    const rejected = UnhandledRejections.nextAsync();
    await page.clickAsync("Open the page again");

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("drops the notice of GitHub's page that didn't open once the sign-in finishes", async () => {
    const page = await new Page().openAsync(HostSignIn.waiting(code));
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await page.clickAsync("Open the page again");
    const failed = page.texts("[role=alert] .nol-git-github-strong");
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    await page.settleAsync();

    expect(failed).toEqual(["The page couldn't be opened."]);
    expect([page.element.querySelector("[role=alert]"), page.texts(".nol-git-github-strong")]).toEqual([null, ["example-user"]]);
  });

  it("drops the notice of a sign-in it couldn't read once a sign-in change comes, and shows the new sign-in", async () => {
    const page = new Page();
    page.requests.fail(GitHubNames.readSignInMethod, new WindowFailure("Not connected."));
    await page.openAsync(null);
    const failed = page.texts("[role=alert] .nol-git-github-strong");
    page.context.raiseEvent(GitHubNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await page.settleAsync();

    expect(failed).toEqual(["GitHub's sign-in didn't answer."]);
    expect([page.element.querySelector("[role=alert]"), page.labels()]).toEqual([null, ["Sign in to GitHub"]]);
  });
});
