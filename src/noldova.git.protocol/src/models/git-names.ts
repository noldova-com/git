/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GitNames {
  public static readonly moduleId: string = "git";
  public static readonly statusMethod: string = "git.status";
  public static readonly diffMethod: string = "git.diff";
  public static readonly branchesMethod: string = "git.branches";
  public static readonly logMethod: string = "git.log";
  public static readonly worktreesMethod: string = "git.worktrees";
  public static readonly stageMethod: string = "git.stage";
  public static readonly unstageMethod: string = "git.unstage";
  public static readonly createBranchMethod: string = "git.createBranch";
  public static readonly switchBranchMethod: string = "git.switchBranch";
  public static readonly commitMethod: string = "git.commit";
  public static readonly pushMethod: string = "git.push";
  public static readonly pullMethod: string = "git.pull";
  public static readonly pullHooksMethod: string = "git.pullHooks";
  public static readonly watchMethod: string = "git.watch";
  public static readonly unwatchMethod: string = "git.unwatch";
  public static readonly changedEvent: string = "git.changed";
  public static readonly folderBinding: string = "git.folder";
  public static readonly repositoriesService: string = "git.repositories";
  public static readonly statusTool: string = "git_status";
  public static readonly diffTool: string = "git_diff";
  public static readonly logTool: string = "git_log";
  public static readonly branchesTool: string = "git_branches";
  public static readonly stageTool: string = "git_stage";
  public static readonly unstageTool: string = "git_unstage";
  public static readonly createBranchTool: string = "git_create_branch";
  public static readonly switchBranchTool: string = "git_switch_branch";
  public static readonly commitTool: string = "git_commit";
  public static readonly pushTool: string = "git_push";
  public static readonly pullTool: string = "git_pull";
}
