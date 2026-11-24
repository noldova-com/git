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

/** A person on a pull request's page with their picture from its host, asked once they first come into view, and their initials until then or when there is none. */
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

  /** The host that finds the person's picture. */
  public readonly host: InputSignal<IGitPullRequestHost> = input.required<IGitPullRequestHost>();
  /** The pull request the person is on. */
  public readonly reference: InputSignal<HostReference> = input.required<HostReference>();
  /** The person's sign-in name, which the initials come from. */
  public readonly login: InputSignal<string> = input.required<string>();
  /** A picture the page already has, shown without asking the host. */
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
