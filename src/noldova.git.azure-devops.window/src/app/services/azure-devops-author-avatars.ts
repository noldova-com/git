/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { AzureDevOpsNames } from "@noldova/git.azure-devops.protocol";
import { AuthorQuery, HostAvatar, PersonQuery } from "@noldova/git.hosting.protocol";
import type { IGitAvatars } from "@noldova/git.window";

import { Resources } from "../../resources.ts";
import { AzureDevOpsReferenceSource } from "./azure-devops-reference-source.ts";

export class AzureDevOpsAuthorAvatars implements IGitAvatars {
  private static readonly shared: WeakMap<IWindowPartContext, AzureDevOpsAuthorAvatars> = new WeakMap();

  private readonly context: IWindowPartContext;
  private readonly references: () => AzureDevOpsReferenceSource;
  private readonly kept: Map<string, WritableSignal<string | null | undefined>> = new Map();
  private readonly signIns: WritableSignal<number> = signal(0);
  private readonly stopListening: () => void;
  private readonly waiting: (() => Promise<void>)[] = [];
  private running: number = 0;

  public constructor(context: IWindowPartContext, references: () => AzureDevOpsReferenceSource) {
    this.context = context;
    this.references = references;
    this.stopListening = context.onEvent(AzureDevOpsNames.signInChangedEvent, () => {
      this.kept.clear();
      this.waiting.length = 0;
      this.signIns.update(t => t + 1);
    });
  }

  public static register(context: IWindowPartContext): AzureDevOpsAuthorAvatars {
    const known: AzureDevOpsAuthorAvatars | undefined = AzureDevOpsAuthorAvatars.shared.get(context);
    if (!Object.isUndefined(known))
      return known;
    const avatars: AzureDevOpsAuthorAvatars = new AzureDevOpsAuthorAvatars(context, () => AzureDevOpsReferenceSource.register(context));
    AzureDevOpsAuthorAvatars.shared.set(context, avatars);
    return avatars;
  }

  public static release(context: IWindowPartContext): void {
    AzureDevOpsAuthorAvatars.shared.get(context)?.stop();
    AzureDevOpsAuthorAvatars.shared.delete(context);
  }

  public avatarOf(folder: string, email: string, commitId: string): string | null | undefined {
    this.signIns();
    const organization: string | null = this.references().homeOf(folder)();
    if (Object.isNull(organization))
      return null;
    const key: string = Resources.formatAvatarKey(organization.toLowerCase(), email.trim().toLowerCase());
    let avatar: WritableSignal<string | null | undefined> | undefined = this.kept.get(key);
    if (Object.isUndefined(avatar)) {
      const reading: WritableSignal<string | null | undefined> = signal(undefined);
      avatar = reading;
      this.kept.set(key, reading);
      this.context.requestAsync(AzureDevOpsNames.readAuthorAvatarMethod, new AuthorQuery(Resources.azureHost, organization, email, commitId).toJson())
        .then(t => reading.set(HostAvatar.fromJson(t).avatar), () => reading.set(null));
    }
    return avatar();
  }

  public personAvatarOf(organization: string, login: string): string | null | undefined {
    if (Resources.isGroupLogin(login))
      return null;
    this.signIns();
    const key: string = Resources.formatAvatarKey(organization.toLowerCase(), login.trim().toLowerCase());
    let avatar: WritableSignal<string | null | undefined> | undefined = this.kept.get(key);
    if (Object.isUndefined(avatar)) {
      const reading: WritableSignal<string | null | undefined> = signal(undefined);
      avatar = reading;
      this.kept.set(key, reading);
      this.queue(() => this.context.requestAsync(AzureDevOpsNames.readPersonAvatarMethod, new PersonQuery(Resources.azureHost, organization, login).toJson())
        .then(t => reading.set(HostAvatar.fromJson(t).avatar), () => reading.set(null)));
    }
    return avatar();
  }

  public stop(): void {
    this.stopListening();
    this.kept.clear();
    this.waiting.length = 0;
  }

  private queue(read: () => Promise<void>): void {
    if (this.running < Resources.referenceReadLimit)
      void this.runAsync(read);
    else
      this.waiting.push(read);
  }

  private async runAsync(read: () => Promise<void>): Promise<void> {
    this.running++;
    await read();
    this.running--;
    const next: (() => Promise<void>) | undefined = this.waiting.shift();
    if (!Object.isUndefined(next))
      void this.runAsync(next);
  }
}
