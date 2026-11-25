/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Component, computed, effect, ElementRef, inject, input, type InputSignal, signal, type Signal, viewChild, type WritableSignal
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import "@noldova/context.core";
import type { GitStatus, StatusUpstream } from "@noldova/git.protocol";
import { ButtonComponent, ButtonVariant, TooltipDirective } from "@noldova/ui.components.angular";

import { GitBranchMenuKind } from "../../enums/git-branch-menu-kind.ts";
import { GitBranchMenuItem } from "../../models/git-branch-menu-item.ts";
import { Resources } from "../../../resources.ts";
import { GitViewStateService } from "../../services/git-view-state.service.ts";
import { GitUndoMenuComponent } from "../git-undo-menu/git-undo-menu.component.ts";

@Component({
  selector: "nol-git-branch-card",
  imports: [ButtonComponent, FormsModule, GitUndoMenuComponent, TooltipDirective],
  templateUrl: "./git-branch-card.component.html",
  styleUrl: "./git-branch-card.component.css",
  host: {
    "(document:pointerdown)": "closeOutside($event)",
    "(focusout)": "closeOnLeave($event)",
    "(keydown.escape)": "escape($event)"
  }
})
export class GitBranchCardComponent {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly trigger: Signal<ElementRef<HTMLButtonElement>> = viewChild.required<ElementRef<HTMLButtonElement>>("trigger");
  private readonly filter: Signal<ElementRef<HTMLInputElement> | undefined> = viewChild<ElementRef<HTMLInputElement>>("filter");

  protected readonly resources: typeof Resources = Resources;
  protected readonly kinds: typeof GitBranchMenuKind = GitBranchMenuKind;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly state: GitViewStateService = inject(GitViewStateService);
  protected readonly isOpen: WritableSignal<boolean> = signal(false);
  protected readonly query: WritableSignal<string> = signal("");
  protected readonly chosen: WritableSignal<number | null> = signal(null);
  protected readonly name: Signal<string> = computed(() => this.status().branch ?? (this.status().head ?? "").slice(0, Resources.shortHeadLength));
  protected readonly upstream: Signal<StatusUpstream | null> = computed(() => this.status().upstream);
  protected readonly items: Signal<readonly GitBranchMenuItem[]> = computed(() => GitBranchMenuItem.itemsOf(this.state.branches(), this.query().trim()));
  protected readonly active: Signal<number> = computed(() => this.chosen() ?? Math.max(0, this.items().findIndex(t => t.isCurrent)));

  public readonly status: InputSignal<GitStatus> = input.required<GitStatus>();

  public constructor() {
    effect(() => this.filter()?.nativeElement.focus());
  }

  protected toggle(): void {
    if (this.state.busy())
      return;
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.find("");
    this.isOpen.set(true);
    void this.state.loadBranchesAsync();
  }

  protected find(query: string): void {
    this.query.set(query);
    this.chosen.set(null);
  }

  protected onKey(event: KeyboardEvent): void {
    const count: number = this.items().length;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (count > 0)
          this.chosen.set((this.active() + (event.key === "ArrowDown" ? 1 : count - 1)) % count);
        break;
      case "Enter": {
        event.preventDefault();
        const item: GitBranchMenuItem | undefined = this.items()[this.active()];
        if (!Object.isUndefined(item))
          this.choose(item);
        break;
      }
    }
  }

  protected escape(event: Event): void {
    if (!this.isOpen())
      return;
    event.preventDefault();
    this.dismiss();
  }

  protected closeOnLeave(event: FocusEvent): void {
    if (this.isOpen() && !(event.relatedTarget instanceof Node && this.element.nativeElement.contains(event.relatedTarget)))
      this.close();
  }

  protected closeOutside(event: PointerEvent): void {
    if (this.isOpen() && !event.composedPath().includes(this.element.nativeElement))
      this.close();
  }

  protected choose(item: GitBranchMenuItem): void {
    if (item.kind === GitBranchMenuKind.Create && item.name.length === 0)
      return;
    this.dismiss();
    if (item.kind === GitBranchMenuKind.Create)
      void this.state.createBranchAsync(item.name);
    else if (!item.isCurrent)
      void this.state.switchBranchAsync(item.name);
  }

  protected push(): void {
    void this.state.pushAsync();
  }

  protected loadPullHooks(): void {
    void this.state.loadPullHooksAsync();
  }

  protected pull(): void {
    void this.state.pullAsync();
  }

  private dismiss(): void {
    this.close();
    this.trigger().nativeElement.focus();
  }

  private close(): void {
    this.isOpen.set(false);
  }
}
