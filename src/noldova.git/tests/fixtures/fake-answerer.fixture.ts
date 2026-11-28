/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { Fake, UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { type IPermissionAnswerer, type IPermissionRequest, type PermissionDecision, PermissionQuestion } from "@noldova/desktop.runtime";

export class FakeAnswerer extends Fake<IPermissionAnswerer> implements IPermissionAnswerer {
  private readonly decisions: PermissionDecision[] = [];

  public readonly answerAsync: IPermissionAnswerer["answerAsync"] = (...args) => this.respondAsync("answerAsync", args, this.answers.answerAsync);

  public constructor() {
    super();
    this.answer("answerAsync", () => {
      const decision = this.decisions.shift();
      return Object.isUndefined(decision) ? Promise.reject(new UnansweredCallException("answerAsync")) : Promise.resolve(decision);
    });
  }

  public get requests(): readonly IPermissionRequest[] {
    return this.callsOf("answerAsync").flatMap(([question]) => question instanceof PermissionQuestion ? [question.request] : []);
  }

  public answerNext(...decisions: readonly PermissionDecision[]): void {
    this.decisions.push(...decisions);
  }
}
