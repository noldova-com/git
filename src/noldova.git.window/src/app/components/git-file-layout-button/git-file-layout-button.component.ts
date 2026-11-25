/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Component, input, type InputSignal, type WritableSignal } from "@angular/core";
import { IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.ts";
import type { GitFileLayout } from "../../enums/git-file-layout.ts";

/** The button that chooses how the lists of changed files are laid out: a tree, folders or a list; every list that shares the layout follows the choice. */
@Component({
  selector: "nol-git-file-layout-button",
  imports: [IconButtonComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective, TooltipDirective],
  templateUrl: "./git-file-layout-button.component.html"
})
export class GitFileLayoutButtonComponent {
  protected readonly resources: typeof Resources = Resources;

  /** The layout it shows and sets, such as the Git view's, which its lists follow. */
  public readonly layout: InputSignal<WritableSignal<GitFileLayout>> = input.required<WritableSignal<GitFileLayout>>();
}
