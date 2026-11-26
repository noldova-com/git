/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Signal } from "@angular/core";

import type { ILinkReferenceSource, LinkReference, LinkReferenceMatch } from "@noldova/ui.components.angular";

import { AzureDevOpsReferenceLinks } from "./azure-devops-reference-links.ts";

export class AzureDevOpsHomeReferences implements ILinkReferenceSource {
  private readonly source: ILinkReferenceSource;
  private readonly home: string;

  public constructor(source: ILinkReferenceSource, home: string) {
    this.source = source;
    this.home = home;
  }

  public find(url: string, text: string): Signal<LinkReference | null> | null {
    return this.source.find(url, text);
  }

  public findText(text: string): readonly LinkReferenceMatch[] {
    return AzureDevOpsReferenceLinks.inText(text, this.home);
  }
}
