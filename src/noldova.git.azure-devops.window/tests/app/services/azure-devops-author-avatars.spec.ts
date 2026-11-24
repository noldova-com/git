/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { AuthorQuery, HostAccount, HostAvatar, HostSignIn, PersonQuery } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AzureDevOpsAuthorAvatars } from "../../../src/app/services/azure-devops-author-avatars.ts";
import { AzureDevOpsReferenceSource } from "../../../src/app/services/azure-devops-reference-source.ts";
import { ReferenceContext } from "../../fixtures/reference-context.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";

describe("AzureDevOpsAuthorAvatars", () => {
  const avatarMethod = "git-azure-devops.readAuthorAvatar";
  const personMethod = "git-azure-devops.readPersonAvatar";
  const commit = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
  const picture = "data:image/png;base64,iVBORw0KGgo=";
  const statusOf = (remote: GitRemote | null): JsonValue => new GitStatus("main", null, null, [], false, "f1", null, remote).toJson();
  let context: ReferenceContext;
  let source: AzureDevOpsReferenceSource;
  let avatars: AzureDevOpsAuthorAvatars;
  let answer: (query: AuthorQuery) => JsonValue | Promise<JsonValue>;
  let answerPerson: (query: PersonQuery) => JsonValue | Promise<JsonValue>;

  const asked = (): readonly JsonValue[] => context.requests.filter(t => t.method === avatarMethod).map(t => t.parameters);
  const askedPeople = (): readonly JsonValue[] => context.requests.filter(t => t.method === personMethod).map(t => t.parameters);

  beforeEach(() => {
    answer = () => new HostAvatar(picture).toJson();
    answerPerson = () => new HostAvatar(picture).toJson();
    context = new ReferenceContext()
      .answerModule("git-azure-devops.readSignIn", () => HostSignIn.signedIn(new HostAccount("monalisa@fabrikam.com", "Mona Lisa", null, [])).toJson())
      .answerModule("git.status", t => statusOf(GitFolderParams.fromJson(t).folder === "/work/plain" ? null
        : new GitRemote("origin", "dev.azure.com", "Fabrikam/web/_git/site", RemoteTransport.Https)))
      .answerModule(avatarMethod, t => answer(AuthorQuery.fromJson(t)))
      .answerModule(personMethod, t => answerPerson(PersonQuery.fromJson(t)));
    source = AzureDevOpsReferenceSource.register(context);
    avatars = new AzureDevOpsAuthorAvatars(context, () => source);
  });

  afterEach(() => {
    avatars.stop();
    AzureDevOpsReferenceSource.release(context);
  });

  it("has none until the folder's organization is known, then reads each author's picture once in it, whatever the email's case or spaces", async () => {
    const before = avatars.avatarOf("/work/site", "MonaLisa@Fabrikam.com ", commit);

    await Wait.until(() => expect(avatars.avatarOf("/work/site", "MonaLisa@Fabrikam.com ", commit)).toBe(picture));
    const again = avatars.avatarOf("/work/site", "monalisa@fabrikam.com", "b".repeat(40));

    expect([before, again]).toEqual([null, picture]);
    expect(asked()).toEqual([new AuthorQuery("dev.azure.com", "Fabrikam", "MonaLisa@Fabrikam.com ", commit).toJson()]);
  });

  it("has none for a folder whose remote isn't Azure DevOps', and none for a picture Azure DevOps has none of or that couldn't be read", async () => {
    answer = t => t.email === "none@fabrikam.com" ? new HostAvatar(null).toJson() : Promise.reject(new Error("Azure DevOps is away."));
    const read = (): readonly (string | null | undefined)[] => [avatars.avatarOf("/work/plain", "monalisa@fabrikam.com", commit),
      avatars.avatarOf("/work/site", "none@fabrikam.com", commit), avatars.avatarOf("/work/site", "down@fabrikam.com", commit)];

    await Wait.until(() => expect([read(), asked().length]).toEqual([[null, null, null], 2]));
  });

  it("reads each picture again once the sign-in changes, and no longer follows it once stopped", async () => {
    avatars.avatarOf("/work/site", "monalisa@fabrikam.com", commit);
    await Wait.until(() => expect(avatars.avatarOf("/work/site", "monalisa@fabrikam.com", commit)).toBe(picture));

    context.emitModule("git-azure-devops.signInChanged", HostSignIn.signedOut().toJson());
    const reading = avatars.avatarOf("/work/site", "monalisa@fabrikam.com", commit);
    await Wait.until(() => expect(avatars.avatarOf("/work/site", "monalisa@fabrikam.com", commit)).toBe(picture));
    avatars.stop();
    context.emitModule("git-azure-devops.signInChanged", HostSignIn.signedOut().toJson());

    expect([reading, avatars.avatarOf("/work/site", "monalisa@fabrikam.com", commit) === undefined, asked().length]).toEqual([undefined, true, 3]);
  });

  it("reads a person's picture once per organization and email, whatever its case or spaces, and an author of that email shares it", async () => {
    const before = [avatars.personAvatarOf("Fabrikam", "MonaLisa@Fabrikam.com "), avatars.personAvatarOf("fabrikam", "monalisa@fabrikam.com")];

    await Wait.until(() => expect(avatars.personAvatarOf("fabrikam", "monalisa@fabrikam.com")).toBe(picture));
    await Wait.until(() => expect(avatars.avatarOf("/work/site", "MonaLisa@fabrikam.com", commit)).toBe(picture));

    expect([before, askedPeople(), asked()]).toEqual([[undefined, undefined], [new PersonQuery("dev.azure.com", "Fabrikam", "MonaLisa@Fabrikam.com ").toJson()], []]);
  });

  it("reads four people's pictures at a time, the next as each read ends, none for a person whose read fails, and none for a group", async () => {
    const releases: ((avatar: JsonValue) => void)[] = [];
    answerPerson = t => t.login === "down@fabrikam.com" ? Promise.reject(new Error("Azure DevOps is away."))
      : new Promise<JsonValue>(resolve => releases.push(resolve));
    const logins: readonly string[] = ["down@fabrikam.com", ...["a", "b", "c", "d", "e"].map(t => `${t}@fabrikam.com`)];
    const read = (): readonly (string | null | undefined)[] => [...logins, "[Web Site]\\Web Team"].map(t => avatars.personAvatarOf("fabrikam", t));

    read();
    await Wait.until(() => expect(askedPeople().length).toBe(5));
    const waiting: number = askedPeople().length;
    releases[0]?.(new HostAvatar(null).toJson());
    await Wait.until(() => expect(askedPeople().length).toBe(6));
    for (const release of releases.slice(1))
      release(new HostAvatar(picture).toJson());

    await Wait.until(() => expect(read()).toEqual([null, null, picture, picture, picture, picture, null]));
    expect([waiting, askedPeople().map(t => PersonQuery.fromJson(t).login)]).toEqual([5, logins]);
  });

  it("gives the Git view and every page of a window part the same pictures until the part releases them", async () => {
    const shared = AzureDevOpsAuthorAvatars.register(context);
    shared.personAvatarOf("fabrikam", "monalisa@fabrikam.com");
    await Wait.until(() => expect(AzureDevOpsAuthorAvatars.register(context).personAvatarOf("fabrikam", "monalisa@fabrikam.com")).toBe(picture));

    AzureDevOpsAuthorAvatars.release(context);
    const released = AzureDevOpsAuthorAvatars.register(context);

    expect([released === shared, askedPeople().length]).toEqual([false, 1]);
    AzureDevOpsAuthorAvatars.release(context);
  });
});
