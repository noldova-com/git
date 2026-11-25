/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, linkedSignal, signal, type Signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { GitFolderProvidedException } from "../exceptions/git-folder-provided.exception.ts";
import type { IGitFolderProvider } from "../interfaces/i-git-folder-provider.ts";
import { GitFolderPage } from "../models/git-folder-page.ts";
import { GitFolderRead } from "../models/git-folder-read.ts";
import { Resources } from "../../resources.ts";

export class GitFolder {
  public static readonly folder: Signal<string | null> = computed(() => GitFolder.provided().folder);
  public static readonly failure: Signal<string | null> = computed(() => GitFolder.provided().failure);

  private static readonly provider: WritableSignal<IGitFolderProvider | null> = signal(null);
  private static readonly shown: WritableSignal<string | null> = signal<string | null>(null);
  private static readonly pages: WritableSignal<readonly GitFolderPage[]> = signal<readonly GitFolderPage[]>([]);
  private static readonly active: Signal<GitFolderPage | undefined> = computed(() => GitFolder.pages().find(t => t.active()));
  /** The followed document that was active last, kept while a document that follows none is in front. */
  private static readonly lastActive: Signal<GitFolderPage | undefined> = linkedSignal<GitFolderPage | undefined, GitFolderPage | undefined>({
    source: GitFolder.active,
    computation: (page, previous) => page ?? previous?.value
  });
  private static readonly provided: Signal<GitFolderRead> = computed(() => GitFolder.read());

  public static provide(context: IWindowPartContext, folder: Signal<string | null>): () => void {
    if (!Object.isNull(GitFolder.provider()))
      throw new GitFolderProvidedException();
    const provider: IGitFolderProvider = { context, folder };
    GitFolder.provider.set(provider);
    return () => {
      if (GitFolder.provider() === provider)
        GitFolder.provider.set(null);
    };
  }

  /**
   * Points the Git views at the repository a document shows, ahead of the provided folder, until the returned function is called or another
   * document is shown; an app calls it for a repository it shows outside a history document.
   */
  public static show(folder: string): () => void {
    GitFolder.shown.set(folder);
    return () => {
      if (GitFolder.shown() === folder)
        GitFolder.shown.set(null);
    };
  }

  /**
   * Points the Git views at a document's repository while the document is the window's active one, ahead of any shown or provided folder, until the
   * returned function is called; while a document that follows none is in front, the views keep the folder of the followed document that was active last, as
   * long as it is followed. The views read the page's signals themselves, so they follow the tab in front even while a page gets no change detection.
   */
  public static follow(folder: Signal<string>, active: Signal<boolean>): () => void {
    const page: GitFolderPage = new GitFolderPage(folder, active);
    GitFolder.pages.set([...GitFolder.pages(), page]);
    return () => GitFolder.pages.set(GitFolder.pages().filter(t => t !== page));
  }

  private static read(): GitFolderRead {
    const provider: IGitFolderProvider | null = GitFolder.provider();
    const page: GitFolderPage | undefined = GitFolder.active();
    const last: GitFolderPage | undefined = GitFolder.lastActive();
    const kept: string | null = !Object.isUndefined(last) && GitFolder.pages().includes(last) ? last.folder() : null;
    const shown: string | null = page?.folder() ?? GitFolder.shown() ?? kept;
    if (Object.isNull(provider))
      return new GitFolderRead(null, null);
    let folder: string | null;
    try {
      folder = shown ?? provider.folder();
    }
    catch (error) {
      provider.context.log(Resources.formatFolderFailed(String(error)));
      return new GitFolderRead(null, error instanceof Error ? error.message : String(error));
    }
    if (!Object.isNull(folder)) {
      const refusal: string | null = GitFolder.refuse(folder);
      if (!Object.isNull(refusal)) {
        provider.context.log(Resources.formatFolderFailed(refusal));
        return new GitFolderRead(null, null);
      }
    }
    return new GitFolderRead(folder, null);
  }

  private static refuse(folder: string): string | null {
    if (folder.trim().length === 0)
      return Resources.blankFolder;
    if (folder.length > Resources.maximumPathLength)
      return Resources.formatFolderTooLong(Resources.maximumPathLength);
    return Resources.absolutePathPattern.test(folder) ? null : Resources.relativeFolder;
  }
}
