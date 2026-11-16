/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type IPermissionDetail, type IPermissionRequest, PermissionDetailKind, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";

import { RequestTooLargeException } from "../exceptions/request-too-large.exception.ts";
import { Resources } from "../resources.ts";

export class WritePermission {
  public static create(
    action: string,
    subject: string,
    title: string,
    details: readonly IPermissionDetail[],
    risk: ToolRisk,
    options: readonly PermissionOption[]): IPermissionRequest {
    if (subject.length > Resources.permissionSubjectLimit || details.length > Resources.permissionDetailCountLimit
      || Buffer.byteLength(JSON.stringify(details)) > Resources.permissionDetailsBytes)
      throw new RequestTooLargeException();
    const request = { action, subject, title: WritePermission.cut(title), details, risk, options };
    return risk !== ToolRisk.High && options.includes(PermissionOption.AllowAlways)
      ? { ...request, labels: { [PermissionOption.AllowAlways]: Resources.alwaysInRepositoryLabel } }
      : request;
  }

  public static hooksDetail(hooks: readonly string[] | null): IPermissionDetail {
    if (hooks === null)
      return { label: Resources.hooksLabel, kind: PermissionDetailKind.Text, value: Resources.unknownHooks };
    return { label: Resources.hooksLabel, kind: PermissionDetailKind.Text, value: hooks.length === 0 ? Resources.noHooks : hooks.join(Resources.listSeparator) };
  }

  public static filtersDetail(filters: readonly string[]): IPermissionDetail {
    return { label: Resources.filtersLabel, kind: PermissionDetailKind.Text, value: filters.join(Resources.listSeparator) };
  }

  private static cut(title: string): string {
    if (title.length <= Resources.permissionTitleLimit)
      return title;
    let end = Resources.permissionTitleLimit - Resources.ellipsis.length;
    const last = title.charCodeAt(end - 1);
    if (last >= Resources.highSurrogateStart && last <= Resources.highSurrogateEnd)
      end -= 1;
    return Resources.formatEllipsized(title, end);
  }
}
