/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, DestroyRef, ElementRef, inject, input, type InputSignal, type Signal, signal, type WritableSignal } from "@angular/core";
import type { HostReference } from "@noldova/git.hosting.protocol";
import { AvatarComponent, AvatarSize } from "@noldova/ui.components.angular";

import type { IGitPullRequestHost } from "../../interfaces/i-git-pull-request-host.ts";

@Component({
  selector: "nol-git-person-avatar",
  templateUrl: "./git-person-avatar.component.html",
  styleUrl: "./git-person-avatar.component.css",
  imports: [AvatarComponent]
})
export class GitPersonAvatarComponent {
  private readonly isSeen: WritableSignal<boolean> = signal<boolean>(false);

  protected readonly shown: Signal<string | null> = computed(() => this.image()
    ?? (this.isSeen() ? this.host().personAvatarOf(this.reference(), this.login()) ?? null : null));

  public readonly host: InputSignal<IGitPullRequestHost> = input.required<IGitPullRequestHost>();
  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();
  public readonly login: InputSignal<string> = input.required<string>();
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
