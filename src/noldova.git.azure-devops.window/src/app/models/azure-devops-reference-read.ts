/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";

import "@noldova/context.core";
import type { LinkReference } from "@noldova/ui.components.angular";

import type { AzureDevOpsReferenceLink } from "./azure-devops-reference-link.ts";

export class AzureDevOpsReferenceRead {
  private readonly shown: WritableSignal<LinkReference | null>;
  private attempt: number = 0;

  public readonly link: AzureDevOpsReferenceLink;
  public readonly pending: LinkReference;

  /** Shows the item's type and number until it's read, and while no one is signed in. */
  public constructor(link: AzureDevOpsReferenceLink, pending: LinkReference) {
    this.link = link;
    this.pending = pending;
    this.shown = signal(pending);
  }

  public get item(): Signal<LinkReference | null> {
    return this.shown.asReadonly();
  }

  public start(): number {
    if (Object.isNull(this.shown()))
      this.shown.set(this.pending);
    return ++this.attempt;
  }

  public stop(): void {
    this.attempt++;
    this.shown.set(this.pending);
  }

  public show(attempt: number, item: LinkReference | null): boolean {
    if (attempt !== this.attempt)
      return false;
    this.shown.set(item);
    return true;
  }
}
