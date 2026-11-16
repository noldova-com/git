/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { computed, signal, type Signal, type WritableSignal } from "@angular/core";
import type { IWindowPartContext } from "@noldova/desktop.window";

import { GitFolderProvidedException } from "../exceptions/git-folder-provided.exception.ts";
import type { IGitFolderProvider } from "../interfaces/i-git-folder-provider.ts";
import { GitFolderRead } from "../models/git-folder-read.ts";
import { Resources } from "../../resources.ts";

export class GitFolder {
  public static readonly folder: Signal<string | null> = computed(() => GitFolder.provided().folder);
  public static readonly failure: Signal<string | null> = computed(() => GitFolder.provided().failure);

  private static readonly provider: WritableSignal<IGitFolderProvider | null> = signal(null);
  private static readonly provided: Signal<GitFolderRead> = computed(() => GitFolder.read());

  public static provide(context: IWindowPartContext, folder: Signal<string | null>): () => void {
    if (GitFolder.provider() !== null)
      throw new GitFolderProvidedException();
    const provider: IGitFolderProvider = { context, folder };
    GitFolder.provider.set(provider);
    return () => {
      if (GitFolder.provider() === provider)
        GitFolder.provider.set(null);
    };
  }

  private static read(): GitFolderRead {
    const provider: IGitFolderProvider | null = GitFolder.provider();
    if (provider === null)
      return new GitFolderRead(null, null);
    let folder: string | null;
    try {
      folder = provider.folder();
    }
    catch (error) {
      provider.context.log(Resources.formatFolderFailed(String(error)));
      return new GitFolderRead(null, error instanceof Error ? error.message : String(error));
    }
    if (folder !== null) {
      const refusal: string | null = GitFolder.refuse(folder);
      if (refusal !== null) {
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
