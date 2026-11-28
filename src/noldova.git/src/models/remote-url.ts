/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { GitRemote, RemoteTransport } from "@noldova/git.protocol";

import { Resources } from "../resources.ts";
import { Required } from "./required.ts";

export class RemoteUrl {

  public static toRemote(name: string, url: string): GitRemote {
    if (Resources.urlSchemePattern.test(url))
      return RemoteUrl.fromUrl(name, url);
    const scp = Resources.drivePattern.test(url) ? null : Resources.scpPattern.exec(url);
    if (Object.isNull(scp))
      return new GitRemote(name, null, null, RemoteTransport.File);
    return new GitRemote(name, RemoteUrl.hostOf(Required.at(scp, 1, Resources.remoteCommand, Resources.remoteUrlPart)), RemoteUrl.pathOf(Required.at(scp, 2, Resources.remoteCommand, Resources.remoteUrlPart)), RemoteTransport.Ssh);
  }

  public static userOf(url: string): string | null {
    const parsed: URL | null = Resources.urlSchemePattern.test(url) ? RemoteUrl.parse(url) : null;
    if (Object.isNull(parsed) || !Resources.httpSchemes.includes(parsed.protocol.toLowerCase()) || parsed.username.length === 0)
      return null;
    let user: string;
    try {
      user = decodeURIComponent(parsed.username);
    } catch (error) {
      if (!(error instanceof URIError))
        throw error;
      return null;
    }
    return Resources.remoteUserPattern.test(user) ? user : null;
  }

  private static parse(url: string): URL | null {
    try {
      return new URL(url);
    } catch (error) {
      if (!(error instanceof TypeError))
        throw error;
      return null;
    }
  }

  private static fromUrl(name: string, url: string): GitRemote {
    const parsed: URL | null = RemoteUrl.parse(url);
    if (Object.isNull(parsed))
      return new GitRemote(name, null, null, RemoteTransport.Other);
    const scheme = parsed.protocol.toLowerCase();
    if (scheme === Resources.fileScheme)
      return new GitRemote(name, null, null, RemoteTransport.File);
    const transport = Resources.sshSchemes.includes(scheme) ? RemoteTransport.Ssh
      : Resources.httpSchemes.includes(scheme) ? RemoteTransport.Https : RemoteTransport.Other;
    let pathname: string;
    try {
      pathname = decodeURIComponent(parsed.pathname);
    } catch (error) {
      if (!(error instanceof URIError))
        throw error;
      pathname = parsed.pathname;
    }
    return new GitRemote(name, RemoteUrl.hostOf(parsed.hostname), RemoteUrl.pathOf(pathname), transport);
  }

  private static hostOf(host: string): string | null {
    return host.length === 0 || Resources.refusedHostPattern.test(host) ? null : host.toLowerCase();
  }

  private static pathOf(value: string): string | null {
    const trimmed = value.replaceAll(Resources.edgeSlashesPattern, "");
    const repository = (trimmed.toLowerCase().endsWith(Resources.gitExtension) ? trimmed.slice(0, -Resources.gitExtension.length) : trimmed)
      .replaceAll(Resources.edgeSlashesPattern, "");
    return Resources.refusedPathPattern.test(repository) || repository.split(Resources.pathSegmentPattern).some(s => Resources.refusedSegmentPattern.test(s))
      ? null : repository;
  }
}
