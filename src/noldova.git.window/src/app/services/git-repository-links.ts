/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import type { GitRemote } from "@noldova/git.protocol";

import type { IGitRepositoryLinks } from "../interfaces/i-git-repository-links.ts";
import type { GitRepositoryLink } from "../models/git-repository-link.ts";

export class GitRepositoryLinks {
  private static readonly provided: WritableSignal<readonly IGitRepositoryLinks[]> = signal([]);

  public static provide(links: IGitRepositoryLinks): () => void {
    GitRepositoryLinks.provided.update(t => [...t, links]);
    return () => GitRepositoryLinks.provided.update(t => t.filter(u => u !== links));
  }

  public static of(remote: GitRemote): readonly GitRepositoryLink[] {
    return GitRepositoryLinks.provided().flatMap(t => t.linksFor(remote));
  }
}
