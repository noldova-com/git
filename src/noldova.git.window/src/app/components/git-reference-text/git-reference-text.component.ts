/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ErrorHandler, inject, Injector, input, type InputSignal, type Signal } from "@angular/core";
import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { LinkOpenEvent, type LinkReference, LinkReferenceChipComponent, LinkReferenceWorkItemStateComponent } from "@noldova/ui.components.angular";

import { GitReferencePart } from "../../models/git-reference-part.ts";
import { GitLinkReferences } from "../../services/git-link-references.ts";

@Component({
  selector: "nol-git-reference-text",
  imports: [LinkReferenceChipComponent, LinkReferenceWorkItemStateComponent],
  templateUrl: "./git-reference-text.component.html",
  styleUrl: "./git-reference-text.component.css"
})
export class GitReferenceTextComponent {
  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly injector: Injector = inject(Injector);

  public readonly text: InputSignal<string> = input.required<string>();

  public readonly folder: InputSignal<string> = input.required<string>();

  public readonly link: InputSignal<string | null> = input<string | null>(null);

  public readonly title: InputSignal<string | null> = input<string | null>(null);

  public readonly chipTabIndex: InputSignal<number | null> = input<number | null>(null);

  protected readonly parts: Signal<readonly GitReferencePart[]> = computed(() => {
    const source = GitLinkReferences.of(this.folder());
    const link = this.link();
    return Object.isNull(link) ? GitReferencePart.of(this.text(), source) : GitReferencePart.linked(this.text(), link, source);
  });

  protected chipOf(part: GitReferencePart): LinkReference | null {
    return part.reference?.() ?? null;
  }

  protected activate(event: MouseEvent, url: string): void {
    event.preventDefault();
    if (!Object.isNull(this.link()))
      return;
    event.stopPropagation();
    this.open(new LinkOpenEvent(url, event));
  }

  protected open(opened: LinkOpenEvent): void {
    if (!GitLinkReferences.opens(this.folder(), opened.url, this.injector))
      void this.context.openLinkAsync(opened.url, { gesture: opened.gesture }).catch((error: unknown) => this.errors.handleError(error));
  }
}
