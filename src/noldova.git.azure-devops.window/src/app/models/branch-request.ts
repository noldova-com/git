/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class BranchRequest {
  public readonly folder: string;
  public readonly organization: string;
  public readonly id: number;
  public readonly title: string;

  public constructor(folder: string, organization: string, id: number, title: string) {
    this.folder = folder;
    this.organization = organization;
    this.id = id;
    this.title = title;
  }

  public get suggestedName(): string {
    const slug = BranchRequest.cut(this.title.toLowerCase().replace(Resources.branchSlugPattern, Resources.dash).replace(Resources.branchSlugEdges, ""));
    return slug.length === 0 ? String(this.id) : `${this.id}${Resources.dash}${slug}`;
  }

  public nameFor(owner: string | null): string {
    return Object.isNull(owner) ? this.suggestedName : Resources.formatOwnedBranch(owner, this.suggestedName);
  }

  public static ownerOf(login: string): string | null {
    const owner = login.replace(Resources.loginDomainPattern, "").toLowerCase().replace(Resources.branchSlugPattern, Resources.dash).replace(Resources.branchSlugEdges, "");
    return owner === "" ? null : owner;
  }

  public static of(folder: string, url: string): BranchRequest | null {
    if (!url.startsWith(Resources.branchScheme))
      return null;
    const address = new URL(url);
    const organization = address.searchParams.get(Resources.branchOrganizationParameter) ?? "";
    const id = Number(address.searchParams.get(Resources.branchIdParameter));
    if (address.pathname !== Resources.branchAction || !Resources.organizationPattern.test(organization) || !Number.isSafeInteger(id) || id < 1)
      return null;
    return new BranchRequest(folder, organization, id, address.searchParams.get(Resources.branchTitleParameter) ?? "");
  }

  private static cut(words: string): string {
    if (words.length <= Resources.branchSlugLength)
      return words;
    const end = words.lastIndexOf(Resources.dash, Resources.branchSlugLength);
    return words.slice(0, end > 0 ? end : Resources.branchSlugLength);
  }
}
