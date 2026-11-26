/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { FieldCheck } from "./field-check.ts";
import { HostReference } from "./host-reference.ts";

export class HostPullRequestHead {
  private static readonly FIELDS: readonly string[] = [Resources.referenceField, Resources.titleField, Resources.urlField, Resources.headBranchField,
    Resources.baseBranchField];

  public readonly reference: HostReference;
  public readonly title: string;
  public readonly url: string;
  public readonly headBranch: string;
  public readonly baseBranch: string | null;

  public constructor(reference: HostReference, title: string, url: string, headBranch: string, baseBranch: string | null, reader?: JsonReader) {
    FieldCheck.requireText(title, Resources.titleField, reader);
    FieldCheck.requireHttps(url, Resources.urlField, reader);
    FieldCheck.requireText(headBranch, Resources.headBranchField, reader);
    if (baseBranch !== null)
      FieldCheck.requireText(baseBranch, Resources.baseBranchField, reader);

    this.reference = reference;
    this.title = title;
    this.url = url;
    this.headBranch = headBranch;
    this.baseBranch = baseBranch;
  }

  public static fromJson(value: unknown, path?: string): HostPullRequestHead {
    const reader = JsonReader.fromValue(value, path);
    FieldCheck.refuseUnknownFields(reader, HostPullRequestHead.FIELDS);
    const reference = reader.readObject(Resources.referenceField);
    return new HostPullRequestHead(
      HostReference.fromJson(reference.toJson(), reference.path),
      reader.readString(Resources.titleField),
      reader.readString(Resources.urlField),
      reader.readString(Resources.headBranchField),
      reader.readNullableString(Resources.baseBranchField),
      reader);
  }

  public toJson(): JsonObject {
    return {
      [Resources.referenceField]: this.reference.toJson(),
      [Resources.titleField]: this.title,
      [Resources.urlField]: this.url,
      [Resources.headBranchField]: this.headBranch,
      [Resources.baseBranchField]: this.baseBranch
    };
  }
}
