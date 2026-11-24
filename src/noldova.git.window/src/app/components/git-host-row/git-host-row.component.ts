/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgComponentOutlet } from "@angular/common";
import { Component, computed, inject, Injector, input, type InputSignal, type Signal } from "@angular/core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { type GitRemote, type GitStatus, RemoteTransport } from "@noldova/git.protocol";

import type { IProvidedGitHostRow } from "../../interfaces/i-provided-git-host-row.ts";
import { GitHostRowView } from "../../models/git-host-row-view.ts";
import { Resources } from "../../../resources.ts";
import { GitHostRows } from "../../services/git-host-rows.ts";

@Component({
  selector: "nol-git-host-row",
  imports: [NgComponentOutlet],
  templateUrl: "./git-host-row.component.html",
  styleUrl: "./git-host-row.component.css"
})
export class GitHostRowComponent {
  private readonly injector: Injector = inject(Injector);
  private readonly provided: Signal<IProvidedGitHostRow | null> = computed(() => GitHostRows.rowFor(this.remote()));

  protected readonly resources: typeof Resources = Resources;
  protected readonly row: Signal<GitHostRowView | null> = computed(() => {
    const provided: IProvidedGitHostRow | null = this.provided();
    return provided === null ? null : new GitHostRowView(
      provided.row.component,
      Injector.create({ providers: [{ provide: WindowPartTokens.context, useValue: provided.context }], parent: this.injector }));
  });
  protected readonly inputs: Signal<Record<string, unknown>> = computed(() => ({
    folder: this.folder(), branch: this.status().branch, head: this.status().head, remote: this.remote()
  }));
  protected readonly plainLine: Signal<string> = computed(() => {
    const remote: GitRemote = this.remote();
    return Resources.formatPlainRemote(remote.name, remote.host ?? remote.path ?? remote.name, GitHostRowComponent.transportOf(remote.transport));
  });

  public readonly remote: InputSignal<GitRemote> = input.required<GitRemote>();
  public readonly status: InputSignal<GitStatus> = input.required<GitStatus>();
  public readonly folder: InputSignal<string> = input.required<string>();

  private static transportOf(transport: RemoteTransport): string {
    switch (transport) {
      case RemoteTransport.Ssh:
        return Resources.ssh;
      case RemoteTransport.Https:
        return Resources.https;
      case RemoteTransport.File:
        return Resources.filePath;
      default:
        return Resources.otherTransport;
    }
  }
}
