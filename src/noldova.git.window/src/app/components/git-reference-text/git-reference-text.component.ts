/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, ErrorHandler, inject, Injector, input, type InputSignal, type Signal } from "@angular/core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { LinkOpenEvent, type LinkReference, LinkReferenceChipComponent, LinkReferenceWorkItemStateComponent } from "@noldova/ui.components.angular";

import { GitReferencePart } from "../../models/git-reference-part.ts";
import { GitLinkReferences } from "../../services/git-link-references.ts";

/**
 * A text with the references the hosts find in it, such as AB#12 or !8, each a link to its page: the kit's chip, with a work item's state after it, once its
 * host has a look for it, and a plain link until then. A clicked one, or a link its chip's card activates, opens in the app when a host claims it and in the
 * browser otherwise, and its click goes no further, so a row it sits in neither selects nor opens. Given a link, the whole text is one reference for the row it
 * names, such as a pull request's number, drawn the same way: its click goes on to the row, which opens it the row's way, once.
 */
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

  /** The text, such as a commit's subject. */
  public readonly text: InputSignal<string> = input.required<string>();

  /** The repository whose hosts find and open the references. */
  public readonly folder: InputSignal<string> = input.required<string>();

  /** The address the whole text links to, such as a pull request's page for its number; null finds the references the text writes. */
  public readonly link: InputSignal<string | null> = input<string | null>(null);

  /** The words after a linked reference, such as a pull request's title: shown after it while its chip shows no title of its own, or it is a plain link. */
  public readonly title: InputSignal<string | null> = input<string | null>(null);

  /** The references' tab index: -1 keeps them out of the tab order of a row that has its own keys; null leaves them in it. */
  public readonly chipTabIndex: InputSignal<number | null> = input<number | null>(null);

  protected readonly parts: Signal<readonly GitReferencePart[]> = computed(() => {
    const source = GitLinkReferences.of(this.folder());
    const link = this.link();
    return link === null ? GitReferencePart.of(this.text(), source) : GitReferencePart.linked(this.text(), link, source);
  });

  /** The look a part's chip draws: its host's, once it has one; null for a plain link. */
  protected chipOf(part: GitReferencePart): LinkReference | null {
    return part.reference?.() ?? null;
  }

  protected activate(event: MouseEvent, url: string): void {
    event.preventDefault();
    if (this.link() !== null)
      return;
    event.stopPropagation();
    this.open(new LinkOpenEvent(url, event));
  }

  protected open(opened: LinkOpenEvent): void {
    if (!GitLinkReferences.opens(this.folder(), opened.url, this.injector))
      void this.context.openLinkAsync(opened.url, { gesture: opened.gesture }).catch((error: unknown) => this.errors.handleError(error));
  }
}
