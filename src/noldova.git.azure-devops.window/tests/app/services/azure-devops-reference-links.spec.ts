/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WorkItemQuery } from "@noldova/git.hosting.protocol";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";
import { describe, expect, it } from "vitest";

import { AzureDevOpsReferenceLinks } from "../../../src/app/services/azure-devops-reference-links.ts";

describe("AzureDevOpsReferenceLinks", () => {
  const repository = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
  const read = (url: string): readonly (string | number)[] | null => {
    const link = AzureDevOpsReferenceLinks.of(url);
    if (link === null)
      return null;
    const { query } = link;
    return query instanceof WorkItemQuery ? [query.host, query.organization, query.id, link.key] : [query.host, query.owner, query.repository, query.number, link.key];
  };

  it("reads a work item's address on dev.azure.com, with or without its project, a trailing slash, a query or a fragment, and the host in any case", () => {
    expect([
      read("https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42"),
      read("https://dev.azure.com/fabrikam/_workitems/edit/42/"),
      read("https://dev.azure.com/Fabrikam/web/_workitems/edit/42?fullScreen=true"),
      read("https://dev.azure.com/fabrikam/web/_workitems/edit/42#comment-1"),
      read("HTTPS://DEV.AZURE.COM/fabrikam/web/_workitems/edit/9999999999")
    ]).toEqual([
      ["git-azure-devops", "fabrikam", 42, "fabrikam#42"],
      ["git-azure-devops", "fabrikam", 42, "fabrikam#42"],
      ["git-azure-devops", "Fabrikam", 42, "fabrikam#42"],
      ["git-azure-devops", "fabrikam", 42, "fabrikam#42"],
      ["git-azure-devops", "fabrikam", 9999999999, "fabrikam#9999999999"]
    ]);
  });

  it("names the project a work item's address gives, decoded, and none for an address without one, one that doesn't decode or a pull request's", () => {
    expect([
      "https://dev.azure.com/fabrikam/Web%20Site/_workitems/edit/42",
      "https://dev.azure.com/fabrikam/_workitems/edit/42",
      "https://fabrikam.visualstudio.com/DefaultCollection/web/_workitems/edit/42",
      "https://dev.azure.com/fabrikam/%E0%A4%A/_workitems/edit/42",
      `https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequest/7`
    ].map(t => AzureDevOpsReferenceLinks.of(t)?.project)).toEqual(["Web Site", null, "web", null, null]);
  });

  it("names the organization and project a page's address gives, decoded, on either host", () => {
    expect([
      "https://dev.azure.com/fabrikam/Web%20Site/_git/site/pullrequest/752",
      "http://fabrikam.visualstudio.com/DefaultCollection/web/_git/site/pullrequest/7",
      "https://fabrikam.visualstudio.com/web/_workitems/edit/3"
    ].map(t => AzureDevOpsReferenceLinks.projectOf(t))).toEqual([["fabrikam", "Web Site"], ["fabrikam", "web"], ["fabrikam", "web"]]);
  });

  it("names no project for an address it can't read, another scheme or host, a page without a project, one that doesn't decode or a bad organization", () => {
    expect([
      "not an address",
      "ftp://dev.azure.com/fabrikam/web/_git/site",
      "https://github.com/fabrikam/web/pull/7",
      "https://dev.azure.com/fabrikam/_workitems/edit/3",
      "https://dev.azure.com/fabrikam/web",
      "https://dev.azure.com/fabrikam/%E0%A4%A/_git/site",
      "https://dev.azure.com/-fabrikam/web/_git/site"
    ].map(t => AzureDevOpsReferenceLinks.projectOf(t))).toEqual([null, null, null, null, null, null, null]);
  });

  it("passes on an error in a work item's project that isn't a bad escape", () => {
    const original = globalThis.decodeURIComponent;
    globalThis.decodeURIComponent = () => {
      throw new RangeError("broken");
    };
    try {
      expect(() => AzureDevOpsReferenceLinks.of("https://dev.azure.com/fabrikam/web/_workitems/edit/42")).toThrow(RangeError);
    }
    finally {
      globalThis.decodeURIComponent = original;
    }
  });

  it("reads a work item's address on an organization's visualstudio.com host, under DefaultCollection or not", () => {
    expect([
      read("https://fabrikam.visualstudio.com/web/_workitems/edit/42"),
      read("https://fabrikam.visualstudio.com/DefaultCollection/web/_workitems/edit/42"),
      read("https://Fabrikam.VisualStudio.com/_workitems/edit/42")
    ]).toEqual(new Array(3).fill(["git-azure-devops", "fabrikam", 42, "fabrikam#42"]));
  });

  it("reads a pull request's address only when it names the repository by its id, which it keeps in lowercase", () => {
    expect([
      read(`https://dev.azure.com/fabrikam/web/_git/${repository.toUpperCase()}/pullrequest/7`),
      read(`https://fabrikam.visualstudio.com/web/_git/${repository}/pullrequest/7/`),
      read("https://dev.azure.com/fabrikam/web/_git/site/pullrequest/7")
    ]).toEqual([
      ["git-azure-devops", "fabrikam", repository, 7, `fabrikam/${repository}!7`],
      ["git-azure-devops", "fabrikam", repository, 7, `fabrikam/${repository}!7`],
      null
    ]);
  });

  it("leaves every other address on Azure DevOps a plain link: a project, a board, a build, a short path, an extra segment and a number out of range", () => {
    expect([
      "https://dev.azure.com/",
      "https://fabrikam.visualstudio.com/",
      "https://dev.azure.com/fabrikam",
      "https://dev.azure.com/fabrikam/web",
      "https://dev.azure.com/fabrikam/web/_workitems",
      "https://dev.azure.com/fabrikam/web/_workitems/edit",
      "https://dev.azure.com/fabrikam/web/_workitems/edit/42/history",
      "https://dev.azure.com/fabrikam/web/team/_workitems/edit/42",
      "https://dev.azure.com/fabrikam//_workitems/edit/42",
      "https://dev.azure.com/fabrikam/web/_workitems/edit/42//",
      "https://dev.azure.com/fabrikam/web/_workitems/edit/0",
      "https://dev.azure.com/fabrikam/web/_workitems/edit/012",
      "https://dev.azure.com/fabrikam/web/_workitems/edit/12345678901",
      "https://dev.azure.com/fabrikam/web/_workitems/edit/1e3",
      "https://dev.azure.com/fabrikam/web/_build/results?buildId=1",
      "https://dev.azure.com/fabrikam/web/_git/site",
      `https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequest/0`,
      `https://dev.azure.com/fabrikam/web/_git/${repository}/pullrequests`,
      `https://dev.azure.com/fabrikam/_git/${repository}/pullrequest/7`
    ].map(read)).toEqual(new Array(19).fill(null));
  });

  it("leaves another scheme, host, port or user info a plain link, and an organization Azure DevOps doesn't allow", () => {
    expect([
      "http://dev.azure.com/fabrikam/web/_workitems/edit/42",
      "https://github.com/fabrikam/web/_workitems/edit/42",
      "https://dev.azure.com.example.com/fabrikam/web/_workitems/edit/42",
      "https://visualstudio.com/web/_workitems/edit/42",
      "https://dev.azure.com:8443/fabrikam/web/_workitems/edit/42",
      "https://monalisa@dev.azure.com/fabrikam/web/_workitems/edit/42",
      "https://:secret@dev.azure.com/fabrikam/web/_workitems/edit/42",
      "dev.azure.com/fabrikam/web/_workitems/edit/42",
      "https://dev.azure.com/-fabrikam/web/_workitems/edit/42",
      "https://dev.azure.com/fabri_kam/web/_workitems/edit/42",
      `https://dev.azure.com/${"f".repeat(51)}/web/_workitems/edit/42`,
      "https://web.fabrikam.visualstudio.com/web/_workitems/edit/42"
    ].map(read)).toEqual(new Array(12).fill(null));
  });

  describe("in a commit's message", () => {
    const found = (text: string, home: string | null = "fabrikam"): readonly (string | number)[][] =>
      AzureDevOpsReferenceLinks.inText(text, home).map(t => [t.start, text.slice(t.start, t.start + t.length), t.url]);

    it("finds #N and AB#N as the organization's work item N, the way Azure DevOps links both", () => {
      expect(found("Fixes AB#42 and #7.\n(AB#5)")).toEqual([
        [6, "AB#42", "https://dev.azure.com/fabrikam/_workitems/edit/42"],
        [16, "#7", "https://dev.azure.com/fabrikam/_workitems/edit/7"],
        [21, "AB#5", "https://dev.azure.com/fabrikam/_workitems/edit/5"]
      ]);
    });

    it("finds nothing in a repository whose remote isn't on Azure DevOps", () => {
      expect(found("Fixes AB#42 and #7.", null)).toEqual([]);
    });

    it("finds no reference glued to a word, a path, an address or an entity, none in another case, and none with a number Azure DevOps doesn't give", () => {
      expect([
        "C#1", "ab#12", "Ab#12", "xAB#12", "AB_#12", "a/b#1", "example.com/a#1", "https://dev.azure.com/x#12", "&#12;", "##12", "#12abc", "AB#12-3", "#0", "AB#0",
        "#012", "#12345678901", "AB#"
      ].map(t => found(t))).toEqual(new Array(17).fill([]));
    });
  });

  describe("the organization of a repository's remote", () => {
    const remote = (host: string | null, path: string | null): GitRemote => new GitRemote("origin", host, path, RemoteTransport.Https);

    it("takes the organization from each of Azure DevOps' remote forms", () => {
      expect([
        remote("dev.azure.com", "fabrikam/Web Site/_git/site"),
        remote("ssh.dev.azure.com", "v3/fabrikam/web/site"),
        remote("vs-ssh.visualstudio.com", "v3/fabrikam/web/site"),
        remote("fabrikam.visualstudio.com", "web/_git/site"),
        remote("fabrikam.visualstudio.com", "DefaultCollection/web/_git/site")
      ].map(t => AzureDevOpsReferenceLinks.homeOf(t))).toEqual(new Array(5).fill("fabrikam"));
    });

    it("takes none from no remote, a remote without a host or path, another host, another path or an organization Azure DevOps doesn't allow", () => {
      expect([
        null, remote(null, null), remote("dev.azure.com", null), remote("github.com", "octocat/hello-world"), remote("dev.azure.com", "fabrikam/web"),
        remote("ssh.dev.azure.com", "fabrikam/web/site"), remote("vs-ssh.visualstudio.com", "v3/fabrikam/web"), remote("fabrikam.visualstudio.com", "web/site"),
        remote("web.fabrikam.visualstudio.com", "web/_git/site"), remote("dev.azure.com", "-fabrikam/web/_git/site")
      ].map(t => AzureDevOpsReferenceLinks.homeOf(t))).toEqual(new Array(10).fill(null));
    });
  });
  describe("organizationIn", () => {
    it("takes a name as typed, and the organization from its host or address on dev.azure.com or visualstudio.com, with or without a scheme", () => {
      expect([
        " Fabrikam ", "fabrikam.visualstudio.com", "FABRIKAM.VisualStudio.com/", "http://fabrikam.visualstudio.com/DefaultCollection/web/_git/site",
        "dev.azure.com/fabrikam", "https://dev.azure.com/fabrikam/web/_git/site?path=/a", "DEV.AZURE.COM/fabrikam/"
      ].map(t => AzureDevOpsReferenceLinks.organizationIn(t))).toEqual(["Fabrikam", "fabrikam", "fabrikam", "fabrikam", "fabrikam", "fabrikam", "fabrikam"]);
    });

    it("takes none from a blank field, another host or scheme, a host with no organization, an address it can't read, or an organization Azure DevOps doesn't allow", () => {
      expect([
        "", "   ", "github.com/fabrikam", "ftp://dev.azure.com/fabrikam", "dev.azure.com", "dev.azure.com/", "https://", "fab/rikam",
        "web.fabrikam.visualstudio.com", "dev.azure.com/-fabrikam", "-fabrikam"
      ].map(t => AzureDevOpsReferenceLinks.organizationIn(t))).toEqual(new Array(11).fill(null));
    });
  });
});
