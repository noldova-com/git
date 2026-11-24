/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Directive, ElementRef, inject, output, type OutputEmitterRef } from "@angular/core";

/** Reports each time its element comes into view or leaves it. */
@Directive({ selector: "[nolGitVisible]" })
export class GitVisibleDirective {
  public readonly visibleChange: OutputEmitterRef<boolean> = output<boolean>();

  public constructor() {
    const observer: IntersectionObserver = new IntersectionObserver(entries => {
      for (const entry of entries)
        this.visibleChange.emit(entry.isIntersecting);
    });
    observer.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
