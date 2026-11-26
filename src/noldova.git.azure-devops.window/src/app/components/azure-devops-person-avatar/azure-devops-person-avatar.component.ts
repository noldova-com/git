/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, ElementRef, inject, input, type InputSignal, type Signal, signal, type WritableSignal } from "@angular/core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { AvatarComponent, AvatarSize } from "@noldova/ui.components.angular";

import { AzureDevOpsAuthorAvatars } from "../../services/azure-devops-author-avatars.ts";

@Component({
  selector: "nol-git-azure-devops-person-avatar",
  templateUrl: "./azure-devops-person-avatar.component.html",
  styleUrl: "./azure-devops-person-avatar.component.css",
  imports: [AvatarComponent]
})
export class AzureDevOpsPersonAvatarComponent {
  private readonly avatars: AzureDevOpsAuthorAvatars = AzureDevOpsAuthorAvatars.register(inject(WindowPartTokens.context));
  private readonly isSeen: WritableSignal<boolean> = signal<boolean>(false);

  protected readonly shown: Signal<string | null> = computed(() => this.image()
    ?? (this.isSeen() ? this.avatars.personAvatarOf(this.organization(), this.login()) ?? null : null));

  public readonly organization: InputSignal<string> = input.required<string>();
  public readonly login: InputSignal<string> = input.required<string>();
  public readonly name: InputSignal<string> = input.required<string>();
  public readonly image: InputSignal<string | null> = input<string | null>(null);
  public readonly size: InputSignal<AvatarSize> = input<AvatarSize>(AvatarSize.Normal);

  public constructor() {
    const observer: IntersectionObserver = new IntersectionObserver(entries => {
      if (!entries.some(t => t.isIntersecting))
        return;
      observer.disconnect();
      this.isSeen.set(true);
    });
    observer.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
