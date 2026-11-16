/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { CheckoutRisks } from "../models/checkout-risks.ts";
import { Resources } from "../resources.ts";
import type { FilterOptionsReader } from "./filter-options.reader.ts";
import type { HooksReader } from "./hooks.reader.ts";
import { LogReader } from "./log.reader.ts";

export class CheckoutRisksReader {
  private readonly hooks: HooksReader;
  private readonly filters: FilterOptionsReader;

  public constructor(hooks: HooksReader, filters: FilterOptionsReader) {
    this.hooks = hooks;
    this.filters = filters;
  }

  public async readAsync(top: string, topHooks: readonly string[], submoduleHooks: readonly string[], signal?: AbortSignal): Promise<CheckoutRisks> {
    const hooks: string[] = [];
    const filters = new Set<string>();
    for (const repository of await this.filters.checkoutRepositoriesAsync(top, signal)) {
      const isTop = repository === top;
      const where = isTop ? null : path.relative(top, repository).split(path.sep).join(Resources.posixSeparator);
      const names = await this.hooks.readAsync(repository, isTop ? topHooks : submoduleHooks, signal);
      hooks.push(...(names ?? [Resources.unknownHooks]).map(t => LogReader.withoutControls(Resources.formatHookName(t, where))));
      for (const name of await this.filters.namesAsync(repository, Resources.checkoutFilterKinds, signal))
        filters.add(name);
    }
    return new CheckoutRisks(hooks, [...filters].map(t => LogReader.withoutControls(t)));
  }
}
