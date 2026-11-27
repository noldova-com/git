/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, input, type InputSignal, output, type OutputEmitterRef, signal, type Signal, type WritableSignal } from "@angular/core";
import { ScanEnd } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, CheckboxComponent, DialogComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";

@Component({
  selector: "nol-git-repository-scan-dialog",
  imports: [ButtonComponent, CheckboxComponent, DialogComponent],
  templateUrl: "./git-repository-scan-dialog.component.html",
  styleUrl: "./git-repository-scan-dialog.component.css"
})
export class GitRepositoryScanDialogComponent {
  public readonly folder: InputSignal<string> = input.required<string>();
  public readonly repositories: InputSignal<readonly string[]> = input.required<readonly string[]>();
  public readonly end: InputSignal<ScanEnd> = input<ScanEnd>(ScanEnd.Complete);
  public readonly answered: OutputEmitterRef<readonly string[] | null> = output<readonly string[] | null>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly title: Signal<string> = computed(() => Resources.formatScanTitle(this.repositories().length, this.folder()));
  protected readonly unticked: WritableSignal<ReadonlySet<string>> = signal(new Set());
  protected readonly ticked: Signal<readonly string[]> = computed(() => this.repositories().filter(t => !this.unticked().has(t)));

  protected readonly cut: Signal<string | null> = computed(() => this.end() === ScanEnd.RepositoryLimit ? Resources.scanRepositoryLimitText
    : this.end() === ScanEnd.FolderLimit ? Resources.scanFolderLimitText : null);
  protected readonly isAllTicked: Signal<boolean> = computed(() => this.unticked().size === 0);

  protected pathOf(repository: string): string {
    return repository.slice(this.folder().length).replace(Resources.scanPrefixPattern, "");
  }

  protected nameOf(repository: string): string {
    return Resources.formatHistoryTitle(repository);
  }

  protected placeOf(repository: string): string {
    const relative: string = this.pathOf(repository);
    return relative.slice(0, Math.max(0, relative.length - this.nameOf(repository).length)).replace(Resources.scanSuffixPattern, "");
  }

  protected tickAll(isTicked: boolean): void {
    this.unticked.set(isTicked ? new Set() : new Set(this.repositories()));
  }

  protected tick(repository: string, isTicked: boolean): void {
    const unticked: Set<string> = new Set(this.unticked());
    if (isTicked)
      unticked.delete(repository);
    else
      unticked.add(repository);
    this.unticked.set(unticked);
  }
}
