/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IWindowPartContext, WindowException } from "@noldova/desktop.window";
import {
  GitFolderParams, GitGraph, GitGraphParams, GitMessageReferenceKind, GitMessageReferences, GitMessageReferencesParams, GitNames, GitStatus
} from "@noldova/git.protocol";

import { LinkedHistory } from "../models/linked-history.ts";
import { Resources } from "../../resources.ts";
import { AzureDevOpsReferenceLinks } from "./azure-devops-reference-links.ts";

/**
 * Reads the commits of a repository's recent history that name a work item: `git.status` for its remote and HEAD, then, for a repository on
 * Azure DevOps, one `git.graph` of its last 1,000 commits and one `git.messageReferences` for the `AB#N` their whole messages name, matched once
 * and kept for that HEAD, so every work item the page opens shares one read.
 */
export class AzureDevOpsLinkedCommits {
  private readonly context: IWindowPartContext;
  private kept: { readonly key: string; readonly history: LinkedHistory } | null = null;

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  /** The repository's linked history; a read the window fails is logged and answers none, and isn't kept. */
  public async readAsync(folder: string): Promise<LinkedHistory> {
    let method: string = GitNames.statusMethod;
    try {
      const status: GitStatus = GitStatus.fromJson(await this.context.requestAsync(method, new GitFolderParams(folder).toJson()));
      const home: string | null = AzureDevOpsReferenceLinks.homeOf(status.remote);
      if (home === null)
        return LinkedHistory.none;
      const key: string = JSON.stringify([folder, status.head]);
      if (this.kept?.key === key)
        return this.kept.history;
      method = GitNames.graphMethod;
      const graph: GitGraph = GitGraph.fromJson(await this.context.requestAsync(method,
        new GitGraphParams(folder, Resources.linkedHistoryLimit, 0).toJson()));
      method = GitNames.messageReferencesMethod;
      const messages: GitMessageReferences = GitMessageReferences.fromJson(await this.context.requestAsync(method,
        new GitMessageReferencesParams(folder, GitMessageReferenceKind.AzureBoards, Resources.linkedHistoryLimit).toJson()));
      const history: LinkedHistory = LinkedHistory.of(graph.commits, messages.commits, home, graph.truncated);
      this.kept = { key, history };
      return history;
    }
    catch (error) {
      if (!(error instanceof WindowException))
        throw error;
      this.context.log(Resources.formatRequestFailed(method, String(error)));
      return LinkedHistory.none;
    }
  }
}
