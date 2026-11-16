/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const RemoteTransport = {
  Ssh: "Ssh",
  Https: "Https",
  File: "File",
  Other: "Other"
} as const;

export type RemoteTransport = (typeof RemoteTransport)[keyof typeof RemoteTransport];
