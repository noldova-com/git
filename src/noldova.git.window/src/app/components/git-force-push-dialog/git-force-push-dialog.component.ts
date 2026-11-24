/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, input, type InputSignal, output, type OutputEmitterRef, type Signal } from "@angular/core";
import { ButtonComponent, ButtonVariant, DialogComponent } from "@noldova/ui.components.angular";

import type { GitForcePushOffer } from "../../models/git-force-push-offer.ts";
import { Resources } from "../../../resources.ts";

/**
 * Asks before a force push, naming the branch, its upstream and the upstream's commit the lease holds it to, and saying that the remote refuses it once
 * that commit has moved. It answers true for Force push, and false for Cancel, Close or Escape.
 */
@Component({
  selector: "nol-git-force-push-dialog",
  imports: [ButtonComponent, DialogComponent],
  templateUrl: "./git-force-push-dialog.component.html",
  styleUrl: "./git-force-push-dialog.component.css"
})
export class GitForcePushDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
  protected readonly text: Signal<string> = computed(() => {
    const offer: GitForcePushOffer = this.offer();
    return Resources.formatForcePushText(offer.branch, offer.upstream, offer.expected.slice(0, Resources.shortIdLength));
  });

  public readonly offer: InputSignal<GitForcePushOffer> = input.required<GitForcePushOffer>();
  public readonly answered: OutputEmitterRef<boolean> = output<boolean>();
}
