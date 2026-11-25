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
  public static readonly diffTotalsMethod: string = "git.diffTotals";
  public static readonly branchesMethod: string = "git.branches";
  public static readonly logMethod: string = "git.log";
  public static readonly graphMethod: string = "git.graph";
  public static readonly messageReferencesMethod: string = "git.messageReferences";
  public static readonly mergedBranchesMethod: string = "git.mergedBranches";
  public static readonly remoteTracksMethod: string = "git.remoteTracks";
  public static readonly worktreesMethod: string = "git.worktrees";
  public static readonly repositoryItemsMethod: string = "git.repositoryItems";
  public static readonly commitDetailMethod: string = "git.commitDetail";
  public static readonly commitSignatureMethod: string = "git.commitSignature";
  public static readonly commitSigningMethod: string = "git.commitSigning";
  public static readonly stageMethod: string = "git.stage";
  public static readonly unstageMethod: string = "git.unstage";
  public static readonly createBranchMethod: string = "git.createBranch";
  public static readonly switchBranchMethod: string = "git.switchBranch";
  public static readonly commitMethod: string = "git.commit";
  public static readonly amendMethod: string = "git.amend";
  public static readonly pushMethod: string = "git.push";
  public static readonly pullMethod: string = "git.pull";
  public static readonly cherryPickMethod: string = "git.cherryPick";
  public static readonly revertMethod: string = "git.revert";
  public static readonly createBranchAtMethod: string = "git.createBranchAt";
  public static readonly renameBranchMethod: string = "git.renameBranch";
  public static readonly deleteBranchMethod: string = "git.deleteBranch";
  public static readonly createTagMethod: string = "git.createTag";
  public static readonly deleteTagMethod: string = "git.deleteTag";
  public static readonly stageLinesMethod: string = "git.stageLines";
  public static readonly unstageLinesMethod: string = "git.unstageLines";
  public static readonly discardMethod: string = "git.discard";
  public static readonly journalMethod: string = "git.journal";
  public static readonly commandLogMethod: string = "git.commandLog";
  public static readonly undoMethod: string = "git.undo";
  public static readonly resetMethod: string = "git.reset";
  public static readonly undoCommitMethod: string = "git.undoCommit";
  public static readonly forcePushMethod: string = "git.forcePush";
  public static readonly pullHooksMethod: string = "git.pullHooks";
  public static readonly avatarMethod: string = "git.avatar";
  public static readonly watchMethod: string = "git.watch";
  public static readonly unwatchMethod: string = "git.unwatch";
  public static readonly conflictMethod: string = "git.conflict";
  public static readonly resolveConflictMethod: string = "git.resolveConflict";
  public static readonly markerCheckMethod: string = "git.markerCheck";
  public static readonly continueOperationMethod: string = "git.continueOperation";
  public static readonly abortOperationMethod: string = "git.abortOperation";
  public static readonly predictMethod: string = "git.predict";
  public static readonly mergeMethod: string = "git.merge";
  public static readonly rebasePlanMethod: string = "git.rebasePlan";
  public static readonly rebaseCheckMethod: string = "git.rebaseCheck";
  public static readonly rebaseMethod: string = "git.rebase";
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
  public static readonly fetchMethod: string = "git.fetch";
  public static readonly stashMethod: string = "git.stash";
}
