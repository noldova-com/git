/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import type { IVitestPluginContext } from "./interfaces/i-vitest-plugin-context.ts";
import type { IVitestPlugin } from "./interfaces/i-vitest-plugin.ts";
import { MarkedModule } from "./marked-module.ts";

export class ClassMetadataCoverage implements IVitestPlugin {
  private readonly ignored: Map<string, readonly string[]> = new Map();

  public readonly name: string = Resources.classMetadataPluginName;
  public readonly enforce: "post" = "post";
  public readonly transform: (code: string, id: string) => MarkedModule | null = (code, id) => this.mark(code, id);
  public readonly configureVitest: (context: IVitestPluginContext) => void = context => context.vitest.onClose(() => context.vitest.logger.log(this.summary));

  public get summary(): string {
    const calls: readonly string[] = [...this.ignored.values()].flat();
    return Resources.formatClassMetadataSummary(calls.length, new Set(calls).size);
  }

  private mark(code: string, id: string): MarkedModule | null {
    const lines: string[] = code.split(Resources.lineEnd);
    const classes: string[] = [];
    for (let index: number = 1; index < lines.length; index++) {
      const name: string | null = this.classAt(lines, index);
      if (name === null)
        continue;
      lines[index - 1] += Resources.classMetadataHint;
      classes.push(name);
    }
    if (classes.length === 0) {
      this.ignored.delete(id);
      return null;
    }
    this.ignored.set(id, classes);
    return new MarkedModule(lines.join(Resources.lineEnd));
  }

  private classAt(lines: readonly string[], index: number): string | null {
    if (lines[index] !== Resources.classMetadataOpening)
      return null;
    const name: string | undefined = Resources.classMetadataCall.exec(lines[index + 1] ?? "")?.[1];
    if (name === undefined || !lines.slice(index + 2).includes(Resources.classMetadataClosing))
      return null;
    return name;
  }
}
