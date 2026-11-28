/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider } from "@angular/core";
import { kitTestProviders } from "@noldova/ui.components.angular/testing";

import { TimeFormatsFixture } from "./fixtures/time-formats.fixture.ts";

export default [...kitTestProviders, TimeFormatsFixture.formats.provider] satisfies Provider[];
