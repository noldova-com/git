/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("The GitHub window part's Resources", () => {
  it("names a failed request, an unreadable event and a link that didn't open, with the reason", () => {
    expect([Resources.formatRequestFailed("git-github.readSignIn", "Error: No."), Resources.formatEventUnread("git-github.signInChanged", "Error: No."),
      Resources.formatLinkFailed("https://github.com", "Error: No.")]).toEqual(["The GitHub module's git-github.readSignIn request failed: Error: No.",
      "The GitHub module's git-github.signInChanged event couldn't be read: Error: No.", "The GitHub module couldn't open https://github.com: Error: No."]);
  });

  it("says where to enter the code before it is copied and to paste it once it is", () => {
    expect([Resources.formatHostRowCode("WDJB-MJHT", false), Resources.formatHostRowCode("WDJB-MJHT", true),
      Resources.formatCodeNote("https://github.com/login/device", "WDJB-MJHT", false)]).toEqual(["Enter WDJB-MJHT on GitHub to sign in.",
      "Paste the code WDJB-MJHT on GitHub's page; it's copied.", "Enter this code at github.com/login/device."]);
  });

  it("counts the code's time down in minutes and two-digit seconds", () => {
    expect([Resources.formatWaiting(872), Resources.formatWaiting(9), Resources.formatWaiting(0)]).toEqual(["Waiting for GitHub. The code expires in 14:32.",
      "Waiting for GitHub. The code expires in 0:09.", "Waiting for GitHub. The code expires in 0:00."]);
  });

  it("writes CSS values: a url, a light-dark pair and a fill", () => {
    expect([Resources.formatCssUrl("data:image/svg+xml,a"), Resources.formatLightDark("#8250DF", "#A371F7"), Resources.formatFill("#8250DF", 14)])
      .toEqual(["url(\"data:image/svg+xml,a\")", "light-dark(#8250DF, #A371F7)", "color-mix(in srgb, #8250DF 14%, transparent)"]);
  });
});
