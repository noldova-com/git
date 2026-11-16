/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class SingleCopyPackage {
  public static readonly cdk: SingleCopyPackage = new SingleCopyPackage(Resources.cdkName, Resources.cdkConsequence, Resources.cdkRemedy);
  public static readonly contextCore: SingleCopyPackage = new SingleCopyPackage(Resources.contextCoreName, Resources.contextCoreConsequence, Resources.contextCoreRemedy);
  public static readonly all: readonly SingleCopyPackage[] = [SingleCopyPackage.cdk, SingleCopyPackage.contextCore];

  public readonly name: string;
  public readonly consequence: string;
  public readonly remedy: string;

  public constructor(name: string, consequence: string, remedy: string) {
    this.name = name;
    this.consequence = consequence;
    this.remedy = remedy;
  }
}
