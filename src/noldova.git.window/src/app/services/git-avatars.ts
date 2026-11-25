/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import "@noldova/context.core";

import type { IGitAvatars } from "../interfaces/i-git-avatars.ts";

/**
 * The commit authors' pictures: each host module's first, asked in the order they were given, then the fallback's.
 * A host still reading holds the fallback back, so a picture doesn't change once shown.
 */
export class GitAvatars {
  private static readonly provided: WritableSignal<readonly IGitAvatars[]> = signal([]);
  private static readonly fallbacks: WritableSignal<readonly IGitAvatars[]> = signal([]);

  public static provide(avatars: IGitAvatars): () => void {
    return GitAvatars.add(GitAvatars.provided, avatars);
  }

  public static provideFallback(avatars: IGitAvatars): () => void {
    return GitAvatars.add(GitAvatars.fallbacks, avatars);
  }

  /** The author's picture as a data address, or null while none is known. */
  public static imageOf(folder: string, email: string, commitId: string): string | null {
    for (const avatars of [...GitAvatars.provided(), ...GitAvatars.fallbacks()]) {
      const image: string | null | undefined = avatars.avatarOf(folder, email, commitId);
      if (!Object.isNull(image))
        return image ?? null;
    }
    return null;
  }

  private static add(list: WritableSignal<readonly IGitAvatars[]>, avatars: IGitAvatars): () => void {
    list.update(t => [...t, avatars]);
    return () => list.update(t => t.filter(u => u !== avatars));
  }
}
