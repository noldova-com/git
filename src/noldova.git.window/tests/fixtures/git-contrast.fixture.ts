/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { LineKind } from "@noldova/git.protocol";
import { FixtureLine } from "./git-fixtures.fixture.ts";

class Rgba {
  public static readonly NONE: Rgba = new Rgba(0, 0, 0, 0);
  public static readonly WHITE: Rgba = new Rgba(255, 255, 255, 1);

  public readonly red: number;
  public readonly green: number;
  public readonly blue: number;
  public readonly alpha: number;

  public constructor(red: number, green: number, blue: number, alpha: number) {
    this.red = red;
    this.green = green;
    this.blue = blue;
    this.alpha = alpha;
  }

  public over(below: Rgba): Rgba {
    const mix = (top: number, under: number): number => top * this.alpha + under * (1 - this.alpha);
    return new Rgba(mix(this.red, below.red), mix(this.green, below.green), mix(this.blue, below.blue), 1);
  }
}

export class GitContrast {
  public static readonly lines: readonly FixtureLine[] = [LineKind.Context, LineKind.Removed, LineKind.Added].flatMap(kind => [
    "function area(r: number): number { return 3.14 * r; } // note",
    "const name = \"old\"; /* gone */ if (name) throw new Error(name);",
    "export class Shape { static of(x: string) { return /a+/g.test(x) ? 1 : 0; } }"
  ].map(text => new FixtureLine(kind, text)));

  public static readonly belowText: Readonly<Record<string, readonly string[]>> = {
    Light: ["added comment", "added control", "added number", "added type", "removed comment", "removed control", "removed number", "removed type"],
    Dark: ["added comment", "added regex", "removed regex"]
  };

  private static readonly canvas: HTMLCanvasElement = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });

  public static lowestOf(diff: Element, lines: string): ReadonlyMap<string, number> {
    const lowest: Map<string, number> = new Map<string, number>();
    for (const line of diff.querySelectorAll(lines))
      for (const span of line.querySelectorAll("[class^='token-']")) {
        const side: string = line.classList.contains("added-line") ? "added" : line.classList.contains("removed-line") ? "removed" : "context";
        const key: string = `${side} ${span.className.slice("token-".length)}`;
        lowest.set(key, Math.min(lowest.get(key) ?? Number.POSITIVE_INFINITY, GitContrast.contrastOf(span, line)));
      }
    return new Map([...lowest].toSorted(([a], [b]) => a.localeCompare(b)));
  }

  public static backgroundsOf(diff: Element, lines: string): readonly (readonly string[])[] {
    const probe: HTMLDivElement = document.createElement("div");
    diff.append(probe);
    const tints: readonly string[] = ["--nol-added-background", "--nol-removed-background"].map(t => {
      probe.style.backgroundColor = `var(${t})`;
      return getComputedStyle(probe).backgroundColor;
    });
    probe.remove();
    const of = (selector: string): string => getComputedStyle(diff.querySelector(`${lines}${selector}`) ?? diff).backgroundColor;
    return [[of(".added-line"), of(".removed-line")], tints];
  }

  public static format(lowest: ReadonlyMap<string, number>): string {
    return [...lowest].map(([key, ratio]) => `${key} ${ratio}`).join(", ");
  }

  private static contrastOf(span: Element, line: Element): number {
    const background: Rgba = GitContrast.backgroundOf(line);
    const text: number = GitContrast.luminanceOf(GitContrast.channelsOf(getComputedStyle(span).color).over(background));
    const behind: number = GitContrast.luminanceOf(background);
    return Math.round((Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05) * 100) / 100;
  }

  private static channelsOf(color: string): Rgba {
    const context: CanvasRenderingContext2D | null = GitContrast.canvas.getContext("2d", { willReadFrequently: true });
    if (Object.isNull(context))
      return Rgba.NONE;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
    return new Rgba(red, green, blue, alpha / 255);
  }

  private static backgroundOf(element: Element): Rgba {
    const layers: Rgba[] = [];
    for (let at: Element | null = element; !Object.isNull(at); at = at.parentElement) {
      const layer: Rgba = GitContrast.channelsOf(getComputedStyle(at).backgroundColor);
      if (layer.alpha > 0)
        layers.push(layer);
      if (layer.alpha === 1)
        break;
    }
    return layers.reduceRight<Rgba>((below, top) => top.over(below), Rgba.WHITE);
  }

  private static luminanceOf(color: Rgba): number {
    const linear = (channel: number): number => channel / 255 <= 0.04045 ? channel / 255 / 12.92 : ((channel / 255 + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linear(color.red) + 0.7152 * linear(color.green) + 0.0722 * linear(color.blue);
  }
}
