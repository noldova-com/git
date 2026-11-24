/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { LineKind } from "@noldova/git.protocol";

type Rgba = readonly [number, number, number, number];

/** Measures the WCAG contrast of a diff's syntax colors on its lines' backgrounds, in whatever space the browser keeps the colors. */
export class GitContrast {
  /** TypeScript that draws every kind of token, as context, removed and added lines. */
  public static readonly lines: readonly [LineKind, string][] = [LineKind.Context, LineKind.Removed, LineKind.Added].flatMap(kind => [
    "function area(r: number): number { return 3.14 * r; } // note",
    "const name = \"old\"; /* gone */ if (name) throw new Error(name);",
    "export class Shape { static of(x: string) { return /a+/g.test(x) ? 1 : 0; } }"
  ].map((text): [LineKind, string] => [kind, text]));

  /**
   * The syntax colors under WCAG's 4.5 for text on the kit's added and removed tints, by mode, as measured: the kit's colors, which a
   * module doesn't override, so a change to them shows here.
   */
  public static readonly belowText: Readonly<Record<string, readonly string[]>> = {
    Light: ["added comment", "added control", "added number", "added type", "removed comment", "removed control", "removed number", "removed type"],
    Dark: ["added comment", "added regex", "removed regex"]
  };

  private static readonly canvas: HTMLCanvasElement = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });

  /** The lowest contrast of each token kind on each line kind under the diff, keyed as "added keyword", in the key order. */
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

  /** The backgrounds an added and a removed line draw, then what the kit's added and removed tints resolve to, as the browser resolves them. */
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

  /** The measurements as one line, for a failure's message and the run's log. */
  public static format(lowest: ReadonlyMap<string, number>): string {
    return [...lowest].map(([key, ratio]) => `${key} ${ratio}`).join(", ");
  }

  /** The WCAG contrast of a span's color on its line's background, to two places. */
  private static contrastOf(span: Element, line: Element): number {
    const background: Rgba = GitContrast.backgroundOf(line);
    const text: number = GitContrast.luminanceOf(GitContrast.over(GitContrast.channelsOf(getComputedStyle(span).color), background));
    const behind: number = GitContrast.luminanceOf(background);
    return Math.round((Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05) * 100) / 100;
  }

  /** A CSS color as red, green and blue from 0 to 255 and alpha from 0 to 1. */
  private static channelsOf(color: string): Rgba {
    const context: CanvasRenderingContext2D | null = GitContrast.canvas.getContext("2d", { willReadFrequently: true });
    if (context === null)
      return [0, 0, 0, 0];
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(0, 0, 1, 1).data;
    return [red, green, blue, alpha / 255];
  }

  private static over(top: Rgba, below: Rgba): Rgba {
    const mix = (i: 0 | 1 | 2): number => top[i] * top[3] + below[i] * (1 - top[3]);
    return [mix(0), mix(1), mix(2), 1];
  }

  /** The color drawn behind an element: its own background over each ancestor's, down to the first opaque one. */
  private static backgroundOf(element: Element): Rgba {
    const layers: Rgba[] = [];
    for (let at: Element | null = element; at !== null; at = at.parentElement) {
      const layer: Rgba = GitContrast.channelsOf(getComputedStyle(at).backgroundColor);
      if (layer[3] > 0)
        layers.push(layer);
      if (layer[3] === 1)
        break;
    }
    return layers.reduceRight<Rgba>((below, top) => GitContrast.over(top, below), [255, 255, 255, 1]);
  }

  private static luminanceOf(color: Rgba): number {
    const linear = (channel: number): number => channel / 255 <= 0.04045 ? channel / 255 / 12.92 : ((channel / 255 + 0.055) / 1.055) ** 2.4;
    return 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
  }
}
