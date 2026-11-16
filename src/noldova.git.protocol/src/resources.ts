/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly nonEmptyTextExpected: string = "a text that isn't empty";
  public static readonly objectIdExpected: string = "a full hexadecimal object id";
  public static readonly unknownField: string = "none, since the model doesn't define it";
  public static readonly keyField: string = "key";
  public static readonly repositoryField: string = "repository";
  public static readonly pathField: string = "path";
  public static readonly branchField: string = "branch";
  public static readonly baseField: string = "base";
  public static readonly objectIdPattern: RegExp = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
  public static readonly countExpected: string = "a whole number of zero or more";
  public static readonly positiveExpected: string = "a whole number above zero";
  public static readonly pathBytesExpected: string = "the path's bytes in base64";
  public static readonly modeExpected: string = "a file mode of six octal digits";
  public static readonly nullExpected: string = "null";
  public static readonly absentExpected: string = "no value";
  public static readonly upstreamGoneExpected: string = "0, since the upstream is gone";
  public static readonly originalPathExpected: string = "a path exactly when the entry is renamed or copied";
  public static readonly scopeRevisionExpected: string = "a revision exactly when the scope is a range";
  public static readonly binaryHunksExpected: string = "no hunks, since the file is binary";
  public static readonly submoduleCommitsExpected: string = "an old or a new commit";
  public static readonly truncatedExpected: string = "true, since files were left out";
  public static readonly oldPathExpected: string = "the path itself, unless the file is renamed or copied";
  public static readonly conflictStatesExpected: string = "Unmodified, since the entry is a conflict";
  public static readonly base64Pattern: RegExp = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
  public static readonly modePattern: RegExp = /^[0-7]{6}$/;
  public static readonly nameField: string = "name";
  public static readonly aheadField: string = "ahead";
  public static readonly behindField: string = "behind";
  public static readonly goneField: string = "gone";
  public static readonly commitChangedField: string = "commitChanged";
  public static readonly trackedChangesField: string = "trackedChanges";
  public static readonly untrackedChangesField: string = "untrackedChanges";
  public static readonly pathBytesField: string = "pathBytes";
  public static readonly originalPathField: string = "originalPath";
  public static readonly originalPathBytesField: string = "originalPathBytes";
  public static readonly indexField: string = "index";
  public static readonly worktreeField: string = "worktree";
  public static readonly conflictField: string = "conflict";
  public static readonly submoduleField: string = "submodule";
  public static readonly headField: string = "head";
  public static readonly upstreamField: string = "upstream";
  public static readonly entriesField: string = "entries";
  public static readonly truncatedField: string = "truncated";
  public static readonly fingerprintField: string = "fingerprint";
  public static readonly currentField: string = "current";
  public static readonly branchesField: string = "branches";
  public static readonly remoteBranchesField: string = "remoteBranches";
  public static readonly gitVersionField: string = "gitVersion";
  public static readonly gitVersionPattern: RegExp = /^\d{1,4}\.\d{1,4}(?:\.[0-9A-Za-z]{1,16}){0,4}$/u;
  public static readonly gitVersionExpected: string = "a Git version such as 2.34.1, and only when git is too old";
  public static readonly kindField: string = "kind";
  public static readonly fromField: string = "from";
  public static readonly toField: string = "to";
  public static readonly oldNumberField: string = "oldNumber";
  public static readonly newNumberField: string = "newNumber";
  public static readonly textField: string = "text";
  public static readonly oldStartField: string = "oldStart";
  public static readonly oldCountField: string = "oldCount";
  public static readonly newStartField: string = "newStart";
  public static readonly newCountField: string = "newCount";
  public static readonly headerField: string = "header";
  public static readonly linesField: string = "lines";
  public static readonly oldCommitField: string = "oldCommit";
  public static readonly newCommitField: string = "newCommit";
  public static readonly oldPathField: string = "oldPath";
  public static readonly oldPathBytesField: string = "oldPathBytes";
  public static readonly changeField: string = "change";
  public static readonly oldModeField: string = "oldMode";
  public static readonly newModeField: string = "newMode";
  public static readonly binaryField: string = "binary";
  public static readonly hunksField: string = "hunks";
  public static readonly filesField: string = "files";
  public static readonly totalBytesField: string = "totalBytes";
  public static readonly omittedFilesField: string = "omittedFiles";
  public static readonly folderExpected: string = "an absolute path of at most 4096 characters";
  public static readonly relativePathExpected: string =
    "a relative path of 1 to 4096 characters, not starting with a drive and colon, a colon or a backslash, without a .. segment or a NUL character";
  public static readonly pathCountExpected: string = "1 to 10000 paths";
  public static readonly diffPathCountExpected: string = "0 to 10000 paths";
  public static readonly branchNameExpected: string =
    "a branch name git accepts: 1 to 255 characters, not - first, not @ or HEAD alone, not . last, without .., @{, a space, a control character or any of ~^:?*[\\, "
    + "and with no segment between slashes that is empty, starts with . or ends with .lock";
  public static readonly hostExpected: string = "a bare host name, without userinfo, a port, a path, a query or a space";
  public static readonly remotePathExpected: string = "a repository path without a scheme, userinfo, a query, a fragment, a leading / or an empty, . or .. segment";
  public static readonly refusedPathStartPattern: RegExp = /^(?:[A-Za-z]:|:|\\)/u;
  public static readonly refusedBranchPattern: RegExp = /[\u0000-\u0020\u007F~^:?*[\\]|\.\.|@\{|\.$/u;
  public static readonly refusedHostPattern: RegExp = /[@:/?#\s]/u;
  public static readonly refusedRemotePathPattern: RegExp = /:\/\/|[@?#]|^\//u;
  public static readonly refusedRemoteSegmentPattern: RegExp = /^(?:\.|%2e){0,2}$/iu;
  public static readonly branchSegmentSeparator: string = "/";
  public static readonly optionPrefix: string = "-";
  public static readonly hiddenPrefix: string = ".";
  public static readonly lockSuffix: string = ".lock";
  public static readonly headShorthand: string = "@";
  public static readonly headName: string = "HEAD";
  public static readonly logLimitExpected: string = "a whole number from 1 to 500";
  public static readonly absolutePathPattern: RegExp = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/u;
  public static readonly pathSeparatorPattern: RegExp = /[\\/]/u;
  public static readonly parentSegment: string = "..";
  public static readonly nulCharacter: string = "\u0000";
  public static readonly noNulExpected: string = "a text without a NUL character";
  public static readonly maximumPathLength: number = 4096;
  public static readonly maximumPathCount: number = 10000;
  public static readonly maximumBranchNameLength: number = 255;
  public static readonly maximumLogLimit: number = 500;
  public static readonly addedField: string = "added";
  public static readonly removedField: string = "removed";
  public static readonly indexCountsField: string = "indexCounts";
  public static readonly worktreeCountsField: string = "worktreeCounts";
  public static readonly messageField: string = "message";
  public static readonly hostField: string = "host";
  public static readonly transportField: string = "transport";
  public static readonly operationField: string = "operation";
  public static readonly remoteField: string = "remote";
  public static readonly remotesField: string = "remotes";
  public static readonly codeField: string = "code";
  public static readonly gitCodeField: string = "gitCode";
  public static readonly folderField: string = "folder";
  public static readonly scopeField: string = "scope";
  public static readonly pathsField: string = "paths";
  public static readonly basedOnField: string = "basedOn";
  public static readonly limitField: string = "limit";
  public static readonly commitsField: string = "commits";
  public static readonly idField: string = "id";
  public static readonly parentsField: string = "parents";
  public static readonly authorField: string = "author";
  public static readonly authoredAtField: string = "authoredAt";
  public static readonly subjectField: string = "subject";
  public static readonly worktreesField: string = "worktrees";
  public static readonly lockedField: string = "locked";
  public static readonly prunableField: string = "prunable";
  public static readonly hooksField: string = "hooks";
  public static readonly maximumLineLength: number = 1000;
  public static readonly controlCharacterPattern: RegExp = /\p{Cc}/u;
  public static readonly dateTimePattern: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u;
  public static readonly lineExpected: string = "a line of at most 1000 characters without a control character";
  public static readonly dateTimeExpected: string = "an ISO 8601 date and time with its offset, such as 2026-11-06T09:30:00-08:00";
  public static readonly commitsExpected: string = "at most 500 commits";

  public static formatFieldPath(parent: string, field: string): string {
    return `${parent}.${field}`;
  }

  public static formatItemField(field: string, index: number): string {
    return `${field}.${index}`;
  }

  public static formatInvalidField(field: string, expectation: string): string {
    return `The field ${field} is invalid: expected ${expectation}.`;
  }
}
