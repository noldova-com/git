/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { AuthorQuery, HostAccount, HostAvatar, HostSignIn } from "@noldova/git.hosting.protocol";
import { GitFolderParams, GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GitHubAuthorAvatars } from "../../../src/app/services/github-author-avatars.ts";
import { GitHubReferenceSource } from "../../../src/app/services/github-reference-source.ts";
import { ReferenceContext } from "../../fixtures/reference-context.fixture.ts";
import { Wait } from "../../fixtures/wait.fixture.ts";

describe("GitHubAuthorAvatars", () => {
  const avatarMethod = "git-github.readAuthorAvatar";
  const commit = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
  const picture = "data:image/png;base64,iVBORw0KGgo=";
  const statusOf = (remote: GitRemote | null): JsonValue => new GitStatus("main", null, null, [], false, "f1", null, remote).toJson();
  let context: ReferenceContext;
  let source: GitHubReferenceSource;
  let avatars: GitHubAuthorAvatars;
  let answer: (query: AuthorQuery) => JsonValue | Promise<JsonValue>;

  const asked = (): readonly JsonValue[] => context.requests.filter(t => t.method === avatarMethod).map(t => t.parameters);

  beforeEach(() => {
    answer = () => new HostAvatar(picture).toJson();
    context = new ReferenceContext()
      .answerModule("git-github.readSignIn", () => HostSignIn.signedIn(new HostAccount("monalisa", null, null, ["repo"])).toJson())
      .answerModule("git.status", t => statusOf(GitFolderParams.fromJson(t).folder === "/work/plain" ? null
        : new GitRemote("origin", "github.com", "octocat/hello-world", RemoteTransport.Https)))
      .answerModule(avatarMethod, t => answer(AuthorQuery.fromJson(t)));
    source = GitHubReferenceSource.register(context);
    avatars = new GitHubAuthorAvatars(context, () => source);
  });

  afterEach(() => {
    avatars.stop();
    GitHubReferenceSource.release(context);
  });

  it("waits for the folder's repository, then reads each author's picture once on github.com, whatever the email's case or spaces", async () => {
    const before = avatars.avatarOf("/work/teamrun", "Kim@Example.com ", commit);

    await Wait.until(() => expect(avatars.avatarOf("/work/teamrun", "Kim@Example.com ", commit)).toBe(picture));
    const again = avatars.avatarOf("/work/teamrun", "kim@example.com", "b".repeat(40));

    expect([before, again]).toEqual([undefined, picture]);
    expect(asked()).toEqual([new AuthorQuery("github.com", "octocat/hello-world", "Kim@Example.com ", commit).toJson()]);
  });

  it("has none for a folder whose remote isn't GitHub's, and none for a picture GitHub has none of or that couldn't be read", async () => {
    answer = t => t.email === "none@example.com" ? new HostAvatar(null).toJson() : Promise.reject(new Error("GitHub is away."));
    avatars.avatarOf("/work/plain", "kim@example.com", commit);
    avatars.avatarOf("/work/teamrun", "none@example.com", commit);
    avatars.avatarOf("/work/teamrun", "down@example.com", commit);

    await Wait.until(() => expect([avatars.avatarOf("/work/plain", "kim@example.com", commit), avatars.avatarOf("/work/teamrun", "none@example.com", commit),
      avatars.avatarOf("/work/teamrun", "down@example.com", commit)]).toEqual([null, null, null]));
    expect(asked().length).toBe(2);
  });

  it("reads each picture again once the sign-in changes, and no longer follows it once stopped", async () => {
    avatars.avatarOf("/work/teamrun", "kim@example.com", commit);
    await Wait.until(() => expect(avatars.avatarOf("/work/teamrun", "kim@example.com", commit)).toBe(picture));

    context.emitModule("git-github.signInChanged", HostSignIn.signedOut().toJson());
    const reading = avatars.avatarOf("/work/teamrun", "kim@example.com", commit);
    await Wait.until(() => expect(avatars.avatarOf("/work/teamrun", "kim@example.com", commit)).toBe(picture));
    avatars.stop();
    context.emitModule("git-github.signInChanged", HostSignIn.signedOut().toJson());

    expect([reading, avatars.avatarOf("/work/teamrun", "kim@example.com", commit) === undefined, asked().length]).toEqual([undefined, true, 3]);
  });
});
