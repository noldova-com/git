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
import type { GitRuntimeClient } from "./git-runtime-client.ts";

export class GitGravatars implements IGitAvatars {
  private readonly client: GitRuntimeClient;
  private readonly kept: Map<string, WritableSignal<string | null | undefined>> = new Map();

  public constructor(client: GitRuntimeClient) {
    this.client = client;
  }

  public avatarOf(_folder: string, email: string, _commitId: string): string | null | undefined {
    const key: string = email.trim().toLowerCase();
    let image: WritableSignal<string | null | undefined> | undefined = this.kept.get(key);
    if (Object.isUndefined(image)) {
      const reading: WritableSignal<string | null | undefined> = signal(key.length === 0 ? null : undefined);
      image = reading;
      this.kept.set(key, reading);
      if (key.length > 0)
        this.client.avatarAsync(key).then(t => reading.set(t.image), () => reading.set(null));
    }
    return image();
  }
}
