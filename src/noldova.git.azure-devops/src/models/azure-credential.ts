/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class AzureCredential {
  private value: string;
  private canWrite: boolean = true;

  private constructor(authorization: string) {
    this.value = authorization;
  }

  public get authorization(): string {
    return this.value;
  }

  public get canWriteCode(): boolean {
    return this.canWrite;
  }

  public static ofToken(token: string): AzureCredential {
    return new AzureCredential(Resources.formatBasic(token));
  }

  public static ofAccess(accessToken: string): AzureCredential {
    return new AzureCredential(Resources.formatBearer(accessToken));
  }

  public renew(accessToken: string, canWriteCode: boolean): void {
    this.value = Resources.formatBearer(accessToken);
    this.canWrite = canWriteCode;
  }
}
