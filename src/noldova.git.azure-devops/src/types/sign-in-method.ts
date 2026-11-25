/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RequestContext } from "@noldova/desktop.runtime";
import type { HostSignIn } from "@noldova/git.hosting.protocol";

/** What a sign-in method runs for a request: the sign-in it leaves, at once or once it settles. */
export type SignInMethod = (request: RequestContext) => HostSignIn | Promise<HostSignIn>;
