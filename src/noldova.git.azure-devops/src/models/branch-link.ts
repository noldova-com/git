/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { AzureRepository } from "./azure-repository.ts";

export class BranchLink {
  public readonly repository: AzureRepository;
  public readonly id: number;
  public readonly branch: string;

  public constructor(repository: AzureRepository, id: number, branch: string) {
    this.repository = repository;
    this.id = id;
    this.branch = branch;
  }

  public static fromJson(value: unknown): BranchLink | null {
    const reader: JsonReader = JsonReader.fromValue(value);
    const repository: AzureRepository | null = AzureRepository.parse(reader.readString(Resources.hostField), reader.readString(Resources.pathField));
    const id: number = reader.readInteger(Resources.idField);
    const branch: string = reader.readNonBlankString(Resources.branchField);
    return Object.isNull(repository) || id < 1 || branch.length > Resources.maximumBranchLength ? null : new BranchLink(repository, id, branch);
  }
}
