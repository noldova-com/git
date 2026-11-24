/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { LinkPlace, WindowPartTokens } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { HostAccount, HostSignIn, SignInFailure } from "@noldova/git.hosting.protocol";
import { GitNames, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { GitFolder } from "@noldova/git.window";
import { describe, expect, it, onTestFinished } from "vitest";

import { AzureDevOpsSignInComponent } from "../../../../src/app/components/azure-devops-sign-in/azure-devops-sign-in.component.ts";
import { RequestAnswers } from "../../../fixtures/request-answers.fixture.ts";
import { UnhandledRejections } from "../../../fixtures/unhandled-rejections.fixture.ts";
import { WindowFailure } from "../../../fixtures/window-failure.fixture.ts";

const TOKEN: string = "example-token-value";
const TOKENS_URL: string = "https://dev.azure.com/fabrikam/_usersSettings/tokens";
const ADDRESS: string = "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=contoso&state=example";
const statusOf = (remote: GitRemote | null): GitStatus => new GitStatus("main", null, null, [], false, "f1", null, remote);

function showFolder(): void {
  onTestFinished(GitFolder.provide(new FakeWindowPartContext(), signal("/work/site")));
}
const account: HostAccount = new HostAccount("monalisa@example.com", "Mona Lisa", null, []);
const unnamed: HostAccount = new HostAccount("octocat@example.com", null, null, []);

class Page {
  public readonly context: FakeWindowPartContext = new FakeWindowPartContext();
  public readonly browser = { placeFor: (): LinkPlace => LinkPlace.InApp, openAsync: (): Promise<void> => Promise.resolve() };
  public readonly requests: RequestAnswers = new RequestAnswers(this.context);
  public fixture: ComponentFixture<AzureDevOpsSignInComponent> | null = null;

  public get element(): HTMLElement {
    const element = this.fixture?.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error("The page isn't open.");
    return element;
  }

  public get field(): HTMLInputElement {
    const field = this.element.querySelector(".nol-git-azure-devops-token");
    if (!(field instanceof HTMLInputElement))
      throw new Error("The page has no token field.");
    return field;
  }

  public get organization(): HTMLInputElement {
    const field = this.element.querySelector(".nol-git-azure-devops-organization");
    if (!(field instanceof HTMLInputElement))
      throw new Error("The page has no organization field.");
    return field;
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

  public answerFolder(remote: GitRemote | null): void {
    this.requests.answer(GitNames.statusMethod, statusOf(remote).toJson());
  }

  public registerInAppBrowser(): void {
    this.context.registerInAppBrowser(this.browser);
  }

  public async openAsync(first: HostSignIn | null): Promise<this> {
    if (first !== null)
      this.requests.answer(AzureDevOpsNames.readSignInMethod, first.toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: this.context }] });
    this.fixture = TestBed.createComponent(AzureDevOpsSignInComponent);
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
    const buttons = [...this.element.querySelectorAll("button")];
    const found = buttons.find(t => t.querySelector(".nol-button-label")?.textContent?.trim() === label) ?? buttons.find(t => (t.textContent ?? "").includes(label));
    if (found === undefined)
      throw new Error(`No button reads ${label}.`);
    return found;
  }

  public async clickAsync(label: string): Promise<void> {
    this.button(label).click();
    await this.settleAsync();
  }

  public async typeOrganizationAsync(text: string): Promise<void> {
    this.organization.value = text;
    this.organization.dispatchEvent(new Event("input"));
    await this.settleAsync();
  }

  public async typeAsync(text: string): Promise<void> {
    if (this.organization.value === "")
      await this.typeOrganizationAsync("fabrikam");
    this.field.value = text;
    this.field.dispatchEvent(new Event("input"));
    await this.settleAsync();
  }

  public async pressEnterAsync(): Promise<void> {
    this.field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await this.settleAsync();
  }
}

describe("AzureDevOpsSignInComponent", () => {
  it("reads the sign-in when it opens and offers a token sign-in for an organization with what it brings, its token's scope and where to make one", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const field = page.field;
    const organization = page.organization;

    expect(page.requests.methods).toEqual([AzureDevOpsNames.readSignInMethod]);
    expect([...page.texts("h3, p, h4"), ...page.labels()]).toEqual(["Account",
      "Sign in to see pull requests, their checks and their reviewers' votes. Git works without it.",
      "The token needs the Code (Read) scope in this organization. It's kept in this computer's secrets.", "Or sign in with Microsoft",
      "Your organization's admin may need to approve this app.", "Sign in", "Make a token on Azure DevOps", "Sign in with Microsoft"]);
    expect([organization.type, organization.autocomplete, organization.getAttribute("aria-label"), organization.placeholder, organization.value,
      organization.classList.contains("nol-text-field")]).toEqual(["text", "off", "Organization", "Organization, as in dev.azure.com/organization", "", true]);
    expect([field.type, field.autocomplete, field.getAttribute("aria-label"), field.placeholder, field.value, field.classList.contains("nol-text-field")])
      .toEqual(["password", "off", "Personal access token", "Paste a personal access token", "", true]);
    expect([page.button("Sign in").disabled, page.button("Make a token").disabled, page.element.querySelector("[role=alert]")]).toEqual([true, true, null]);
  });

  it("fills the organization from the open repository's Azure DevOps remote, and signs in and makes a token there", async () => {
    showFolder();
    const page = new Page();
    page.answerFolder(new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https));
    page.requests.answer(AzureDevOpsNames.signInWithTokenMethod, HostSignIn.signedOut().toJson());
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync(HostSignIn.signedOut());
    const filled = page.organization.value;

    await page.clickAsync("Make a token on Azure DevOps");
    await page.typeAsync(TOKEN);
    await page.clickAsync("Sign in");

    expect([filled, page.links, page.requests.payloads]).toEqual(["fabrikam", [TOKENS_URL],
      [null, { folder: "/work/site" }, { token: TOKEN, organization: "fabrikam" }]]);
  });

  it.each([
    ["an old-style https", new GitRemote("origin", "fabrikam.visualstudio.com", "DefaultCollection/web/_git/site", RemoteTransport.Https)],
    ["an old-style ssh", new GitRemote("origin", "vs-ssh.visualstudio.com", "v3/fabrikam/web/site", RemoteTransport.Ssh)]
  ])("makes a token on the organization's visualstudio.com page for %s remote, and on dev.azure.com for another organization typed in its place", async (_, remote) => {
    showFolder();
    const page = new Page();
    page.answerFolder(remote);
    page.context.answer("openLinkAsync", async () => undefined);
    await page.openAsync(HostSignIn.signedOut());

    await page.clickAsync("Make a token on Azure DevOps");
    await page.typeOrganizationAsync(" Contoso ");
    await page.clickAsync("Make a token on Azure DevOps");
    await page.typeOrganizationAsync("FABRIKAM");
    await page.clickAsync("Make a token on Azure DevOps");

    expect(page.links).toEqual(["https://fabrikam.visualstudio.com/_usersSettings/tokens", "https://dev.azure.com/Contoso/_usersSettings/tokens",
      "https://FABRIKAM.visualstudio.com/_usersSettings/tokens"]);
  });

  it.each([
    ["a remote that isn't Azure DevOps'", new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)],
    ["no remote", null]
  ])("leaves the organization for the person to type for %s", async (_, remote) => {
    showFolder();
    const page = new Page();
    page.answerFolder(remote);
    await page.openAsync(HostSignIn.signedOut());

    expect([page.organization.value, page.requests.methods]).toEqual(["", [AzureDevOpsNames.readSignInMethod, GitNames.statusMethod]]);
  });

  it("keeps an organization the person typed before the repository's remote was read", async () => {
    showFolder();
    const typed = new Page();
    const release = typed.requests.hold(GitNames.statusMethod);
    typed.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: typed.context }] });
    typed.fixture = TestBed.createComponent(AzureDevOpsSignInComponent);
    typed.fixture.detectChanges();
    await typed.requests.askedAsync(2);
    await typed.requests.answered[0];
    typed.fixture.detectChanges();
    typed.organization.value = "contoso";
    typed.organization.dispatchEvent(new Event("input"));
    release(statusOf(new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https)).toJson());
    await typed.settleAsync();

    expect(typed.organization.value).toBe("contoso");
  });

  it("holds Sign in and the token page while the organization isn't a name Azure DevOps takes, and sends nothing on Enter", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());

    await page.typeOrganizationAsync("fab/rikam");
    await page.typeAsync(TOKEN);
    await page.pressEnterAsync();
    page.organization.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await page.settleAsync();

    expect([page.button("Sign in").disabled, page.button("Make a token").disabled, page.requests.methods])
      .toEqual([true, true, [AzureDevOpsNames.readSignInMethod]]);
  });

  it.each([
    ["its visualstudio.com host", "fabrikam.visualstudio.com", "https://fabrikam.visualstudio.com/_usersSettings/tokens"],
    ["its visualstudio.com address", " https://Fabrikam.visualstudio.com/DefaultCollection/web ", "https://fabrikam.visualstudio.com/_usersSettings/tokens"],
    ["its dev.azure.com address", "https://dev.azure.com/fabrikam/web/_git/site", "https://dev.azure.com/fabrikam/_usersSettings/tokens"],
    ["dev.azure.com and its name", "dev.azure.com/fabrikam", "https://dev.azure.com/fabrikam/_usersSettings/tokens"]
  ])("takes the organization from %s, signs in there and makes a token there, with no note", async (_, text, tokens) => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.context.answer("openLinkAsync", async () => undefined);
    page.requests.answer(AzureDevOpsNames.signInWithTokenMethod, HostSignIn.signedOut().toJson());

    await page.typeOrganizationAsync(text);
    await page.clickAsync("Make a token on Azure DevOps");
    await page.typeAsync(TOKEN);
    await page.pressEnterAsync();

    expect([page.links, page.requests.payloads.at(-1), page.texts(".nol-git-azure-devops-organization-note")])
      .toEqual([[tokens], { token: TOKEN, organization: "fabrikam" }, []]);
  });

  it("says what the organization field takes while it holds something that names no organization, and nothing while it's blank", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const blank = page.texts(".nol-git-azure-devops-organization-note");

    await page.typeOrganizationAsync("github.com/fabrikam");
    const other = page.texts(".nol-git-azure-devops-organization-note");
    await page.typeOrganizationAsync("  ");

    expect([blank, other, page.texts(".nol-git-azure-devops-organization-note")])
      .toEqual([[], ["Type the organization's name, or paste its address on dev.azure.com or visualstudio.com."], []]);
  });

  it("fills the organization from the repository's remote over a field holding only spaces, but keeps text that names no organization", async () => {
    showFolder();
    const typed = new Page();
    const release = typed.requests.hold(GitNames.statusMethod);
    typed.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: typed.context }] });
    typed.fixture = TestBed.createComponent(AzureDevOpsSignInComponent);
    typed.fixture.detectChanges();
    await typed.requests.askedAsync(2);
    await typed.requests.answered[0];
    typed.fixture.detectChanges();
    typed.organization.value = "fab/rikam";
    typed.organization.dispatchEvent(new Event("input"));
    release(statusOf(new GitRemote("origin", "dev.azure.com", "fabrikam/web/_git/site", RemoteTransport.Https)).toJson());
    await typed.settleAsync();

    expect(typed.organization.value).toBe("fab/rikam");
  });

  it("signs in on Enter in the organization field once both are filled", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.answer(AzureDevOpsNames.signInWithTokenMethod, HostSignIn.signedIn(account).toJson());

    await page.typeAsync(TOKEN);
    page.organization.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await page.settleAsync();

    expect(page.requests.payloads.at(-1)).toEqual({ token: TOKEN, organization: "fabrikam" });
  });

  it("offers the token sign-in first, and Sign in with Microsoft below it as a second option held until the organization names one", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const held: boolean = page.button("Sign in with Microsoft").disabled;

    await page.typeOrganizationAsync("fabrikam");

    expect([held, page.button("Sign in with Microsoft").disabled, page.labels().at(-1), page.texts("h4"),
      page.button("Sign in with Microsoft").classList.contains("nol-button-secondary"), page.button("Sign in").classList.contains("nol-button-secondary")])
      .toEqual([true, false, "Sign in with Microsoft", ["Or sign in with Microsoft"], true, false]);
  });

  it("starts the sign-in with Microsoft for the organization, opens its address in the system's browser and waits, offering to open it again or cancel", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.registerInAppBrowser();
    page.context.answer("openLinkAsync", async () => undefined);
    page.requests.answer(AzureDevOpsNames.startSignInMethod, HostSignIn.waitingInBrowser(ADDRESS).toJson());
    page.requests.answer(AzureDevOpsNames.cancelSignInMethod, HostSignIn.signedOut().toJson());
    await page.typeOrganizationAsync("https://dev.azure.com/fabrikam/website");

    await page.clickAsync("Sign in with Microsoft");
    const waiting = [page.texts(".nol-git-azure-devops-heading p"), page.labels(), page.element.querySelectorAll("input, nol-spinner").length];
    await page.clickAsync("Open the sign-in again");
    await page.clickAsync("Cancel");

    expect(waiting).toEqual([["Finish signing in with Microsoft in the browser; this page updates once you're done."], ["Open the sign-in again", "Cancel"], 1]);
    expect([page.requests.methods, page.requests.payloads.slice(1), page.links, page.places]).toEqual([[AzureDevOpsNames.readSignInMethod,
      AzureDevOpsNames.startSignInMethod, AzureDevOpsNames.cancelSignInMethod], [{ organization: "fabrikam" }, null], [ADDRESS, ADDRESS], [LinkPlace.System, LinkPlace.System]]);
    expect([page.labels().at(-1), page.element.querySelector("[role=alert]")]).toEqual(["Sign in with Microsoft", null]);
  });

  it("shows the account once the sign-in with Microsoft ends signed in, and why once it ends signed out", async () => {
    const page = await new Page().openAsync(HostSignIn.waitingInBrowser(ADDRESS));

    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut(SignInFailure.Denied).toJson());
    await page.settleAsync();
    const denied = page.texts("[role=alert] span span");
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    await page.settleAsync();

    expect([denied, page.texts(".nol-git-azure-devops-strong")]).toEqual([["The sign-in was refused.",
      "Sign in again, and accept what the sign-in asks to read and write."], ["monalisa@example.com"]]);
  });

  it("says the sign-in didn't answer when the start fails, opening nothing", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.fail(AzureDevOpsNames.startSignInMethod, new WindowFailure("Gone."));
    await page.typeOrganizationAsync("fabrikam");

    await page.clickAsync("Sign in with Microsoft");

    expect([page.links, page.texts("[role=alert] .nol-git-azure-devops-strong")]).toEqual([[], ["Azure DevOps' sign-in didn't answer."]]);
  });

  it("stays waiting and says so when the browser can't open the sign-in, and opens nothing for a start that answers no address", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    page.requests.answer(AzureDevOpsNames.startSignInMethod, HostSignIn.signedIn(account).toJson());
    await page.typeOrganizationAsync("fabrikam");

    await page.clickAsync("Sign in with Microsoft");
    const signedIn = [page.links, page.texts(".nol-git-azure-devops-strong")];
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    page.requests.answer(AzureDevOpsNames.startSignInMethod, HostSignIn.waitingInBrowser(ADDRESS).toJson());
    await page.settleAsync();
    await page.clickAsync("Sign in with Microsoft");

    expect(signedIn).toEqual([[], ["monalisa@example.com"]]);
    expect([page.links, page.texts("[role=alert] .nol-git-azure-devops-strong"), page.labels()]).toEqual([[ADDRESS], ["The page couldn't be opened."],
      ["Open the sign-in again", "Cancel"]]);
  });

  it("logs a repository read that fails, leaving the organization blank", async () => {
    showFolder();
    const page = new Page();
    page.requests.fail(GitNames.statusMethod, new WindowFailure("Not a repository."));
    await page.openAsync(HostSignIn.signedOut());

    expect([page.organization.value, page.logs]).toEqual(["", ["The Azure DevOps module's git.status request failed: WindowFailure: Not a repository."]]);
  });

  it("passes on a repository read that fails other than as the window's, logging nothing", async () => {
    showFolder();
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(GitNames.statusMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();
    await page.openAsync(HostSignIn.signedOut());

    expect([await rejected, page.organization.value, page.logs]).toEqual([unexpected, "", []]);
  });

  it("offers Sign in only while the field holds more than spaces", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());

    await page.typeAsync("   ");
    const blank = page.button("Sign in").disabled;
    await page.typeAsync(TOKEN);
    const filled = page.button("Sign in").disabled;
    await page.typeAsync("");

    expect([blank, filled, page.button("Sign in").disabled]).toEqual([true, false, true]);
  });

  it("signs in with the trimmed token on Sign in, clears the field, and shows the account it answers", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.answer(AzureDevOpsNames.signInWithTokenMethod, HostSignIn.signedIn(account).toJson());
    await page.typeAsync(`  ${TOKEN}  `);
    const field = page.field;

    await page.clickAsync("Sign in");

    expect([page.requests.methods, page.requests.payloads]).toEqual([[AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.signInWithTokenMethod],
      [null, { token: TOKEN, organization: "fabrikam" }]]);
    expect([field.value, page.element.querySelector("input"), page.texts(".nol-git-azure-devops-account-text > span"), page.labels()])
      .toEqual(["", null, ["monalisa@example.com", "Mona Lisa · signed in on this computer"], ["Sign out"]]);
  });

  it("signs in on Enter in the field as on Sign in, and sends nothing on Enter while the field is blank", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.answer(AzureDevOpsNames.signInWithTokenMethod, HostSignIn.signedIn(account).toJson());

    await page.typeAsync("  ");
    await page.pressEnterAsync();
    const blank = [...page.requests.methods];
    await page.typeAsync(TOKEN);
    await page.pressEnterAsync();

    expect(blank).toEqual([AzureDevOpsNames.readSignInMethod]);
    expect([page.requests.payloads.at(-1), page.texts(".nol-git-azure-devops-strong")]).toEqual([{ token: TOKEN, organization: "fabrikam" }, ["monalisa@example.com"]]);
  });

  it("clears the field and says why when Azure DevOps refuses the token, leaving Sign in held until a new token is typed", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.answer(AzureDevOpsNames.signInWithTokenMethod, HostSignIn.signedOut(SignInFailure.Refused).toJson());
    await page.typeAsync(TOKEN);

    await page.clickAsync("Sign in");

    expect([page.field.value, page.button("Sign in").disabled, page.texts("[role=alert] .nol-git-azure-devops-banner-text > span")])
      .toEqual(["", true, ["Azure DevOps didn't accept the sign-in.",
        "Check that the account belongs to this organization, or that the token was copied whole and hasn't expired, then sign in again."]]);
  });

  it("clears the field and says the sign-in didn't answer when the request fails, logging why without the token", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.requests.fail(AzureDevOpsNames.signInWithTokenMethod, new WindowFailure("Not connected."));
    await page.typeAsync(TOKEN);

    await page.clickAsync("Sign in");

    expect([page.field.value, page.button("Sign in").disabled, page.texts("[role=alert] .nol-git-azure-devops-strong")])
      .toEqual(["", true, ["Azure DevOps' sign-in didn't answer."]]);
    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.signInWithTokenMethod} request failed: WindowFailure: Not connected.`]);
    expect(page.logs.some(t => String(t).includes(TOKEN))).toBe(false);
  });

  it("clears the field and passes on a failure of the sign-in that isn't the window's, logging nothing", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(AzureDevOpsNames.signInWithTokenMethod, unexpected);
    await page.typeAsync(TOKEN);
    const rejected = UnhandledRejections.nextAsync();

    await page.clickAsync("Sign in");

    expect(await rejected).toBe(unexpected);
    expect([page.field.value, page.logs, page.element.querySelector("[role=alert]")]).toEqual(["", [], null]);
  });

  it("holds the field and its buttons while the token is out, and marks the section busy", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const release = page.requests.hold(AzureDevOpsNames.signInWithTokenMethod);
    await page.typeAsync(TOKEN);

    page.button("Sign in").click();
    await page.requests.askedAsync(2);
    page.fixture?.detectChanges();
    const held = [page.field.disabled, page.button("Sign in").disabled, page.element.querySelector("section")?.getAttribute("aria-busy")];
    release(HostSignIn.signedOut(SignInFailure.Unreachable).toJson());
    await page.settleAsync();

    expect(held).toEqual([true, true, "true"]);
    expect([page.field.disabled, page.field.value, page.element.querySelector("section")?.getAttribute("aria-busy"),
      page.texts("[role=alert] .nol-git-azure-devops-strong")]).toEqual([false, "", "false", ["Azure DevOps couldn't be reached."]]);
  });

  it("says the sign-in can't be read, logs why, and reads it again on Try again", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Not connected."));
    await page.openAsync(null);
    const failed = [...page.texts("h3, [role=alert] .nol-git-azure-devops-banner-text > span"), ...page.labels()];
    page.requests.answer(AzureDevOpsNames.readSignInMethod, HostSignIn.signedOut().toJson());
    await page.clickAsync("Try again");

    expect(failed).toEqual(["Account", "Azure DevOps' sign-in didn't answer.", "Try again; the app's log has the details.", "Try again"]);
    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.readSignInMethod} request failed: WindowFailure: Not connected.`]);
    expect([page.element.querySelector("[role=alert]"), page.labels(), page.requests.methods])
      .toEqual([null, ["Sign in", "Make a token on Azure DevOps", "Sign in with Microsoft"], [AzureDevOpsNames.readSignInMethod, AzureDevOpsNames.readSignInMethod]]);
  });

  it("passes on a failure of the sign-in's read that isn't the window's, rather than saying Azure DevOps' sign-in didn't answer", async () => {
    const page = new Page();
    const unexpected = new TypeError("Unexpected.");
    page.requests.fail(AzureDevOpsNames.readSignInMethod, unexpected);
    const rejected = UnhandledRejections.nextAsync();
    await page.openAsync(null);

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("logs a failed read that a newer sign-in change overtook, but shows the newer account without saying the read didn't answer", async () => {
    const page = new Page();
    const reject = page.requests.holdFailure(AzureDevOpsNames.readSignInMethod);
    const opening = page.openAsync(null);
    await page.requests.askedAsync(1);
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    reject(new WindowFailure("Not connected."));
    await opening;

    expect([page.element.querySelector("[role=alert]"), page.texts(".nol-git-azure-devops-strong")]).toEqual([null, ["monalisa@example.com"]]);
    expect(page.logs).toEqual([`The Azure DevOps module's ${AzureDevOpsNames.readSignInMethod} request failed: WindowFailure: Not connected.`]);
  });

  it("names why the last sign-in ended, in place of what a sign-in brings", async () => {
    const shown: (string | boolean)[][] = [];
    for (const failure of Object.values(SignInFailure)) {
      const page = await new Page().openAsync(HostSignIn.signedOut(failure));
      shown.push([...page.texts("[role=alert] span span"), page.texts(".nol-git-azure-devops-heading p").length === 0]);
      TestBed.resetTestingModule();
    }

    expect(shown).toEqual([
      ["The sign-in expired.", "Sign in again.", true],
      ["The sign-in was refused.", "Sign in again, and accept what the sign-in asks to read and write.", true],
      ["Azure DevOps no longer accepts the sign-in.", "The sign-in or its token expired or was revoked; sign in again.", true],
      ["Azure DevOps couldn't be reached.", "Check the connection, then sign in again.", true],
      ["Azure DevOps didn't accept the sign-in.",
        "Check that the account belongs to this organization, or that the token was copied whole and hasn't expired, then sign in again.", true],
      ["This computer couldn't keep the sign-in.", "Sign in again; the app's log has the details.", true],
      ["This computer couldn't remove the sign-in.", "The app may sign in with it when it next starts; the app's log has the details.", true]
    ]);
  });

  it("opens Azure DevOps' token page in the system's browser while the in-app browser takes other links", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.registerInAppBrowser();
    page.context.answer("openLinkAsync", async () => undefined);
    await page.typeOrganizationAsync("fabrikam");

    await page.clickAsync("Make a token on Azure DevOps");

    expect([page.links, page.places, page.element.querySelector("[role=alert]")]).toEqual([[TOKENS_URL], [LinkPlace.System], null]);
  });

  it("keeps the field shown when the token page can't open, and says and logs that it didn't", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    page.context.answer("openLinkAsync", async () => {
      throw new WindowFailure("No browser.");
    });
    await page.typeOrganizationAsync("fabrikam");

    await page.clickAsync("Make a token on Azure DevOps");

    expect([page.links, page.element.querySelectorAll("input").length, page.texts("[role=alert] .nol-git-azure-devops-strong")])
      .toEqual([[TOKENS_URL], 2, ["The page couldn't be opened."]]);
    expect(page.logs).toEqual([`The Azure DevOps module couldn't open ${TOKENS_URL}: WindowFailure: No browser.`]);
  });

  it("passes on a failure to open the token page that isn't the window's, rather than saying the page couldn't be opened", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    const unexpected = new TypeError("Unexpected.");
    page.context.answer("openLinkAsync", async () => {
      throw unexpected;
    });
    await page.typeOrganizationAsync("fabrikam");
    const rejected = UnhandledRejections.nextAsync();
    await page.clickAsync("Make a token on Azure DevOps");

    expect(await rejected).toBe(unexpected);
    expect([page.logs, page.element.querySelector("[role=alert]")]).toEqual([[], null]);
  });

  it("shows the account by its login and name, with its name's initial and no picture, and signs out", async () => {
    const page = await new Page().openAsync(HostSignIn.signedIn(account));
    const avatar = page.element.querySelector("nol-avatar");
    const shown = [...page.texts(".nol-git-azure-devops-account-text > span"), avatar?.textContent?.trim(), avatar?.querySelector("img") ?? null];
    page.requests.answer(AzureDevOpsNames.signOutMethod, HostSignIn.signedOut().toJson());

    await page.clickAsync("Sign out");

    expect(shown).toEqual(["monalisa@example.com", "Mona Lisa · signed in on this computer", "M", null]);
    expect([page.requests.methods.at(-1), page.labels()]).toEqual([AzureDevOpsNames.signOutMethod, ["Sign in", "Make a token on Azure DevOps", "Sign in with Microsoft"]]);
  });

  it("shows an account with no name by its login alone, with the login's initial", async () => {
    const page = await new Page().openAsync(HostSignIn.signedIn(unnamed));

    expect([...page.texts(".nol-git-azure-devops-account-text > span"), page.element.querySelector("nol-avatar")?.textContent?.trim()])
      .toEqual(["octocat@example.com", "Signed in on this computer", "O"]);
  });

  it("drops a sign-in answer that a newer sign-in change overtook", async () => {
    const page = new Page();
    const release = page.requests.hold(AzureDevOpsNames.readSignInMethod);
    const asked = page.requests.askedAsync(1);

    const opening = page.openAsync(null);
    await asked;
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    release(HostSignIn.signedOut().toJson());
    await opening;

    expect([page.texts(".nol-git-azure-devops-strong"), page.labels()]).toEqual([["monalisa@example.com"], ["Sign out"]]);
  });

  it("follows the sign-in's changes until it closes", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());

    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    await page.settleAsync();
    const shown = page.texts(".nol-git-azure-devops-strong");
    const following = page.context.activeCallsOf("onEvent").filter(t => t[0] === AzureDevOpsNames.signInChangedEvent).length;
    page.fixture?.destroy();

    expect([shown, following, page.context.activeCallsOf("onEvent").filter(t => t[0] === AzureDevOpsNames.signInChangedEvent).length])
      .toEqual([["monalisa@example.com"], 1, 0]);
  });

  it("holds Sign in on a new, empty field once a sign-in elsewhere took the typed one away", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    await page.typeAsync(TOKEN);

    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedIn(account).toJson());
    await page.settleAsync();
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await page.settleAsync();

    expect([page.field.value, page.button("Sign in").disabled]).toEqual(["", true]);
  });

  it("keeps a typed token and its Sign in when a change leaves the sign-in signed out", async () => {
    const page = await new Page().openAsync(HostSignIn.signedOut());
    await page.typeAsync(TOKEN);

    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut(SignInFailure.Revoked).toJson());
    await page.settleAsync();

    expect([page.field.value === TOKEN, page.button("Sign in").disabled, page.texts("[role=alert] .nol-git-azure-devops-strong")])
      .toEqual([true, false, ["Azure DevOps no longer accepts the sign-in."]]);
  });

  it("drops the notice of a sign-in it couldn't read once a sign-in change comes, and shows the new sign-in", async () => {
    const page = new Page();
    page.requests.fail(AzureDevOpsNames.readSignInMethod, new WindowFailure("Not connected."));
    await page.openAsync(null);
    const failed = page.texts("[role=alert] .nol-git-azure-devops-strong");
    page.context.raiseEvent(AzureDevOpsNames.signInChangedEvent, HostSignIn.signedOut().toJson());
    await page.settleAsync();

    expect(failed).toEqual(["Azure DevOps' sign-in didn't answer."]);
    expect([page.element.querySelector("[role=alert]"), page.labels()]).toEqual([null, ["Sign in", "Make a token on Azure DevOps", "Sign in with Microsoft"]]);
  });
});
