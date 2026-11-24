/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly lineEnd: string = "\n";
  public static readonly encoding: BufferEncoding = "utf8";
  public static readonly pathSeparator: string = "/";
  public static readonly windowsPathSeparator: string = "\\";
  public static readonly listSeparator: string = ", ";
  public static readonly indent: string = "  ";
  public static readonly dash: string = "-";
  public static readonly dot: string = ".";
  public static readonly underscore: string = "_";
  public static readonly scopeMark: string = "@";
  public static readonly jsonIndent: number = 2;
  public static readonly successExitCode: number = 0;
  public static readonly failureExitCode: number = 1;
  public static readonly signalExitCode: number = 128;
  public static readonly windowsPlatform: string = "win32";
  public static readonly pathVariable: string = "PATH";
  public static readonly npmPathVariable: string = "npm_execpath";
  public static readonly sourceFolder: string = "src";
  public static readonly apiFolder: string = "api";
  public static readonly nodeModulesFolder: string = "node_modules";
  public static readonly viteCacheFolder: string = ".vite";
  public static readonly gitFolder: string = ".git";
  public static readonly archivesFolder: string = "_packages";
  public static readonly packagesWorkSegments: readonly string[] = ["_build", "packages"];
  public static readonly compiledSegments: readonly string[] = ["_build", "compiled"];
  public static readonly manifestFile: string = "package.json";
  public static readonly moduleFile: string = "module.json";
  public static readonly projectFile: string = "tsconfig.json";
  public static readonly specProjectFile: string = "tsconfig.spec.json";
  public static readonly licenseFile: string = "LICENSE";
  public static readonly noticesFile: string = "THIRD-PARTY-NOTICES.md";
  public static readonly readmeFile: string = "README.md";
  public static readonly windowEntryFile: string = "window.ts";
  public static readonly entryName: string = "index";
  public static readonly moduleFiles: readonly string[] = ["module.json", "settings.json", "menus.json", "cli.json", "webViews.json"];
  public static readonly versionFiles: readonly string[] = ["version.json", "package.json"];
  public static readonly typeScriptExtension: string = ".ts";
  public static readonly declarationExtension: string = ".d.ts";
  public static readonly javaScriptExtension: string = ".js";
  public static readonly archiveExtension: string = ".tgz";
  public static readonly protocolSuffix: string = ".protocol";
  public static readonly windowSuffix: string = ".window";
  public static readonly cliSuffix: string = ".cli";
  public static readonly protocolPart: string = "protocol";
  public static readonly runtimePart: string = "runtime";
  public static readonly windowPart: string = "window";
  public static readonly cliPart: string = "cli";
  public static readonly mainModuleName: string = "noldova.git";
  public static readonly mainPackageName: string = "@noldova/git";
  public static readonly gitHubModuleName: string = "noldova.git.github";
  public static readonly gitHubPackageName: string = "@noldova/git.github";
  public static readonly azureDevOpsModuleName: string = "noldova.git.azure-devops";
  public static readonly azureDevOpsPackageName: string = "@noldova/git.azure-devops";
  public static readonly hostingProtocolFolder: string = "src/noldova.git.hosting.protocol";
  public static readonly hostingProtocolPackageName: string = "@noldova/git.hosting.protocol";
  public static readonly packageScope: string = "@noldova";
  public static readonly angularCore: string = "@angular/core";
  public static readonly angularPrefix: string = "@angular/";
  public static readonly corePrefix: string = "@noldova/desktop.";
  public static readonly contextPrefix: string = "@noldova/context.";
  public static readonly uiKitName: string = "@noldova/ui.components.angular";
  public static readonly editorName: string = "@noldova/editor.angular";
  public static readonly cdkName: string = "@angular/cdk";
  public static readonly cdkConsequence: string = "so the UI kit's overlays and focus handling and the app's would run from different ones";
  public static readonly cdkRemedy: string = "Install the version the UI kit pins, so npm keeps one copy.";
  public static readonly contextCoreName: string = "@noldova/context.core";
  public static readonly contextCoreConsequence: string =
    "so the second to load throws \"Cannot redefine property\", since each defines the same fixed properties on Object";
  public static readonly contextCoreRemedy: string = "Take context's packages as peers at the versions Noldova Desktop pins, so npm keeps one copy.";
  public static readonly nameField: string = "name";
  public static readonly versionField: string = "version";
  public static readonly privateField: string = "private";
  public static readonly exportsField: string = "exports";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly devDependenciesField: string = "devDependencies";
  public static readonly peersField: string = "peerDependencies";
  public static readonly peersMetaField: string = "peerDependenciesMeta";
  public static readonly optionalField: string = "optional";
  public static readonly commitField: string = "gitHead";
  public static readonly noldovaDesktopField: string = "noldovaDesktop";
  public static readonly idField: string = "id";
  public static readonly partsField: string = "parts";
  public static readonly contributesField: string = "contributes";
  public static readonly manifestExport: string = "./package.json";
  public static readonly partExports: readonly string[] = ["./runtime", "./window"];
  public static readonly pinFields: readonly string[] = ["dependencies", "peerDependencies", "optionalDependencies"];
  public static readonly dependencyFields: readonly string[] = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  public static readonly moduleFields: readonly string[] = ["id", "version", "displayName", "description", "parts", "dependencies", "noldovaDesktop", "contributes"];
  /** The fields a module.json may leave out: the modules it uses when the app includes them, each at one exact version. */
  public static readonly optionalModuleFields: readonly string[] = ["optionalDependencies"];
  public static readonly declarationTextFields: readonly string[] = ["displayName", "description"];
  public static readonly contributionKinds: readonly string[] = [
    "methods", "events", "commands", "notifications", "views", "documents", "statusBarItems", "topBarActions", "menus", "themes", "settings", "settingScopes",
    "settingsPages", "cliCommands", "tools"
  ];
  public static readonly toolsKind: string = "tools";
  public static readonly reservedModuleId: string = "desktop";
  public static readonly maximumToolNameLength: number = 64;
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly moduleVersionPattern: RegExp = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;
  public static readonly contributionNamePattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly declarationPinPattern: RegExp = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly exactPinPattern: RegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly rangePattern: RegExp = /^>=((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) <((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
  public static readonly scopePattern: RegExp = /^@([^/]+)\/(.+)$/;
  public static readonly scopeReplacement: string = "$1-$2";
  public static readonly declarationImportPattern: RegExp = /(from\s+"\.{1,2}\/[^"]*)\.d\.ts"/g;
  public static readonly packageImportPattern: RegExp = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])((?:@[^/"']+\/)?[^/"'.][^/"']*)(?:\/[^"']*)?\1/g;
  public static readonly quotes: readonly string[] = ["\"", "'", "`"];
  public static readonly escapeCharacter: string = "\\";
  public static readonly commentSlash: string = "/";
  public static readonly commentStar: string = "*";
  public static readonly blockCommentEnd: string = "*/";
  public static readonly archiveFolder: string = "package";
  public static readonly archiveModuleEntry: string = "package/module.json";
  public static readonly nothingNamed: string = "nothing";
  public static readonly missingValue: string = "missing";
  public static readonly tarBlockBytes: number = 512;
  public static readonly tarNameStart: number = 0;
  public static readonly tarNameEnd: number = 100;
  public static readonly tarSizeStart: number = 124;
  public static readonly tarSizeEnd: number = 136;
  public static readonly tarTypeAt: number = 156;
  public static readonly tarPrefixStart: number = 345;
  public static readonly tarPrefixEnd: number = 500;
  public static readonly tarSizeRadix: number = 8;
  public static readonly tarHeaderEncoding: BufferEncoding = "latin1";
  public static readonly tarFileTypes: readonly string[] = ["0", "\0"];
  public static readonly tarExtendedType: string = "x";
  public static readonly tarPathRecord: RegExp = /^\d+ path=(.*)$/m;
  public static readonly tarFieldEnd: RegExp = /\0.*$/s;
  public static readonly outputLimitBytes: number = 16 * 1024 * 1024;
  public static readonly stopGraceMilliseconds: number = 5_000;
  public static readonly streamWaitMilliseconds: number = 5_000;
  public static readonly stopSignal: NodeJS.Signals = "SIGTERM";
  public static readonly forceSignal: NodeJS.Signals = "SIGKILL";
  public static readonly processGoneCode: string = "ESRCH";
  public static readonly processListCommand: string = "ps";
  public static readonly processListArguments: readonly string[] = ["-A", "-o", "pid=", "-o", "ppid="];
  public static readonly processListSeparator: RegExp = /\s+/;
  public static readonly processListTimeoutMilliseconds: number = 10_000;
  public static readonly taskKillCommand: string = "taskkill";
  public static readonly taskKillArguments: readonly string[] = ["/T", "/PID"];
  public static readonly taskKillForce: string = "/F";
  public static readonly gitCommand: string = "git";
  public static readonly gitTimeoutMilliseconds: number = 60_000;
  public static readonly gitStatusArguments: readonly string[] = ["status", "--porcelain"];
  public static readonly gitCommitArguments: readonly string[] = ["rev-parse", "HEAD"];
  public static readonly npmCommand: string = "npm";
  public static readonly npmTimeoutMilliseconds: number = 600_000;
  public static readonly npmUnavailable: string = "npm_execpath is not set; run this through npm, such as npm run build or npm test.";
  public static readonly npmListCommand: string = "ls";
  public static readonly npmListOptions: readonly string[] = ["--all", "--json", "--long"];
  public static readonly npmListErrorField: string = "error";
  public static readonly npmListCodeField: string = "code";
  public static readonly npmListSummaryField: string = "summary";
  public static readonly npmListPathField: string = "path";
  public static readonly npmListProblemsCode: string = "ELSPROBLEMS";
  public static readonly packArguments: readonly string[] = ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination"];
  public static readonly cleanInstallArguments: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=http"];
  public static readonly noldovaPrefix: string = "@noldova/";
  public static readonly rootPinFields: readonly string[] = [Resources.dependenciesField, Resources.devDependenciesField];
  public static readonly archiveInstallArguments: readonly string[] = ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  public static readonly installTimeoutMilliseconds: number = 600_000;
  public static readonly lockFile: string = "package-lock.json";
  public static readonly lockPackagesField: string = "packages";
  public static readonly lockModulesPrefix: string = "node_modules/";
  public static readonly lockResolvedField: string = "resolved";
  public static readonly fileProtocol: string = "file:";
  public static readonly installedLockSegments: readonly string[] = ["node_modules", ".package-lock.json"];
  public static readonly typeScriptCompiler: readonly string[] = ["node_modules", "typescript", "bin", "tsc"];
  public static readonly projectOption: string = "--project";
  public static readonly angularCompilerPackage: string = "@angular/compiler-cli";
  public static readonly angularCompilerCommand: string = "ngc";
  public static readonly angularProjectOption: string = "-p";
  public static readonly angularWorkPrefix: string = "noldova-angular-package-";
  public static readonly angularCompileTimeoutMilliseconds: number = 300_000;
  public static readonly angularCliPackage: string = "@angular/cli";
  public static readonly angularCliCommand: string = "ng";
  public static readonly angularTestCommand: string = "test";
  public static readonly playwrightPackage: string = "playwright";
  public static readonly playwrightCommand: string = "playwright";
  public static readonly browserInstallArguments: readonly string[] = ["install", "--only-shell", "chromium"];
  public static readonly browserInstallTimeoutMilliseconds: number = 600_000;
  public static readonly componentDecorator: string = "Component";
  public static readonly changeDetectionOption: string = "changeDetection";
  public static readonly onPushMember: string = "OnPush";
  public static readonly onPushValue: number = 0;
  public static readonly skippedSourceFolders: readonly string[] = ["node_modules", "_build", "dist", ".angular"];
  public static readonly classMetadataPluginName: string = "noldova-class-metadata-coverage";
  public static readonly classMetadataOpening: string = "(() => {";
  public static readonly classMetadataClosing: string = "})();";
  public static readonly classMetadataCall: RegExp = /^[\t ]+\(typeof ngDevMode === "undefined" \|\| ngDevMode\) && i\d+\.(?:ɵ|\\u0275)setClassMetadata\(([A-Za-z_$][\w$]*), /u;
  public static readonly classMetadataHint: string = " /* v8 ignore next */";
  public static readonly listCopiesOption: string = "--list-copies";
  public static readonly listCopiesAlone: string = "--list-copies takes no other option.";
  public static readonly copiesEnd: string = "end of copies\n";
  public static readonly buildNeedsNpm: string = "Run it with npm run build, which installs the dependencies through npm.";
  public static readonly installing: string = "Installing npm packages…";
  public static readonly lockFileChanged: string = "package-lock.json is newer than the last install, so the build installs again.";
  public static readonly commitUnstampedOutsideGit: string = "The folder isn't a git checkout, so the packages carry no commit.";
  public static readonly commitUnstampedChanged: string = "The working tree has uncommitted changes, so the packages carry no commit.";
  public static readonly declarationCheckScript: string = "scripts/declarations/declaration-check.ts";
  public static readonly defaultChangeDetectionCheckScript: string = "scripts/checks/default-change-detection-check.ts";
  public static readonly installedPackageScript: string = "scripts/tests/installed-package/install-and-open.ts";
  public static readonly testTimeCheckScript: string = "scripts/checks/test-time-check.ts";
  public static readonly defaultReporter: string = "--reporter=default";
  public static readonly testTimesReporter: readonly string[] = ["--reporter=json", "--outputFile.json=_build/test-times.json"];
  public static readonly testTimesFile: string = "_build/test-times.json";
  public static readonly slowFilesHeading: string = "### Test files over 1 second";
  public static readonly sectionStart: string = `${Resources.lineEnd}#`;
  public static readonly slowFileRow: RegExp = /^\| `([^`]+)` \| (\d+(?:\.\d+)?) s \|/gm;
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly timingFolder: readonly string[] = ["_build", "timing"];
  public static readonly timingRuns: number = 3;
  public static readonly timingMargin: number = 0.5;
  public static readonly rootSuiteName: string = "root";
  public static readonly timingVitestRun: readonly string[] = ["node_modules/vitest/vitest.mjs", "run", "--coverage=false", "--reporter=dot", "--reporter=json"];
  public static readonly jsonOutputOption: string = "--outputFile.json=";
  public static readonly timingAngularTest: readonly string[] = ["test", "--no-coverage", "--reporters=dot", "--reporters=json", "--output-file"];
  public static readonly fileBudgetMilliseconds: number = 1_000;
  public static readonly testResultsField: string = "testResults";
  public static readonly testNameField: string = "name";
  public static readonly testStartField: string = "startTime";
  public static readonly testEndField: string = "endTime";
  public static readonly scriptsProject: string = "scripts/tsconfig.json";
  public static readonly vitestRun: readonly string[] = ["node_modules/vitest/vitest.mjs", "run", "--coverage"];
  public static readonly coverageGates: readonly string[] = ["statements", "branches", "functions", "lines"];
  public static readonly optionPrefix: string = "--";
  public static readonly skipTestDetails: string = "--skip-test-details";
  public static readonly skipCoverageDetails: string = "--skip-coverage-details";
  public static readonly dotReporter: string = "--reporter=dot";
  public static readonly skipFullCoverage: string = "--coverage.skipFull";
  public static readonly noCoverage: string = "--coverage=false";
  public static readonly includeOption: string = "--include";
  public static readonly declarationIdInvalid: string = "module.json's id must be lowercase kebab-case and not \"desktop\".";
  public static readonly declarationVersionInvalid: string =
    "module.json's version must be <major>.<minor>.<patch>, three whole numbers of up to nine digits without leading zeros.";
  public static readonly declarationDependenciesInvalid: string = "module.json's dependencies must be an object from module ids to exact versions.";
  public static readonly declarationContributesInvalid: string = "module.json's contributes must be an object.";
  public static readonly declarationNoldovaDesktopInvalid: string = "module.json's noldovaDesktop must be >=<lowest> <first refused>, from the Noldova Desktop version the module "
    + "builds against to the next minor below 1.0, or the next major from 1.0.";
  public static readonly manifestVersionDiffers: string = "The package's manifest and module.json must have the same version.";
  public static readonly manifestPrivate: string = "The package's manifest must not be private: the module ships as published packages.";
  public static readonly packageManifestDescription: string = "The package's manifest";
  public static readonly windowManifestDescription: string = "The window package's manifest";
  public static readonly rootManifestDescription: string = "The root manifest";
  public static readonly packageManifestName: string = "the package's manifest";
  public static readonly windowManifestName: string = "the window package's manifest";
  public static readonly rangeAlternative: string = " or a range of the form >=<lowest> <first refused>";
  public static readonly peerRangeAlternative: string = ", or a range of the form >=<lowest> <first refused>,";
  public static readonly rangedPrefixes: readonly string[] = [Resources.corePrefix, Resources.contextPrefix];
  public static readonly rangedNames: readonly string[] = [Resources.uiKitName, Resources.editorName];
  public static readonly peerPrefixes: readonly string[] = [Resources.angularPrefix, Resources.corePrefix, Resources.contextPrefix];
  public static readonly peerNames: readonly string[] = [Resources.uiKitName, Resources.editorName];
  public static readonly archiveManifestEntry: string = `${Resources.archiveFolder}${Resources.pathSeparator}${Resources.manifestFile}`;
  public static readonly declarationImportReplacement: string = `$1${Resources.javaScriptExtension}"`;
  public static readonly toolNamePattern: RegExp = new RegExp(`^[a-z][a-z0-9_]{0,${Resources.maximumToolNameLength - 1}}$`);
  public static readonly declarationFieldsInvalid: string = `module.json must have exactly the fields ${Resources.moduleFields.join(Resources.listSeparator)}, and may have ${Resources.optionalModuleFields.join(Resources.listSeparator)}.`;
  public static readonly binField: string = "bin";
  public static readonly notExecutableCodes: readonly string[] = ["ENOENT", "ENOTDIR", "EACCES", "EPERM"];
  public static readonly missingFileCodes: readonly string[] = ["ENOENT", "ENOTDIR"];
  public static readonly gzipFailureCodes: readonly string[] = ["Z_DATA_ERROR", "Z_BUF_ERROR"];
  public static readonly capturedStdio: ["ignore", "pipe", "pipe"] = ["ignore", "pipe", "pipe"];
  public static readonly ignoredStdio: "ignore" = "ignore";
  public static readonly inheritedStdio: "inherit" = "inherit";
  public static readonly fixtureRootSegments: readonly string[] = ["..", "..", ".."];
  public static readonly fixtureArchivePrefix: string = "noldova-git";
  public static readonly fixtureArchiveCount: number = 10;
  public static readonly repositoryPlace: string = "the repository";
  public static readonly fixturePlace: string = "the fixture app";
  public static readonly fixtureContextRangeFile: string = "src/noldova.git.window/package.json";
  public static readonly fixtureContextPackages: readonly string[] = ["@noldova/context.core", "@noldova/context.exceptions", "@noldova/context.json",
    "@noldova/context.text"];
  public static readonly fixturePeers: readonly string[] = ["@noldova/desktop.runtime", "@noldova/desktop.protocol", "@types/node"];
  public static readonly fixtureWorkPrefix: string = "noldova-git-fixture-";
  public static readonly fixtureRemoveRetries: number = 3;
  public static readonly fixtureAppFolder: string = "fixture-app";
  public static readonly fixturePeersFolder: string = "fixture-peers";
  public static readonly fixtureScriptsFolder: string = "scripts";
  public static readonly fixtureScriptFiles: readonly string[] = ["resources.ts", "models/version-range.ts", "exceptions/script.exception.ts",
    "exceptions/installed-package-check-failed.exception.ts", "interfaces/i-installed-runtime-part.ts", "tests/installed-package/installed-package-resources.ts",
    "tests/installed-package/fixture-manifest.ts", "tests/installed-package/open-module.ts", "tests/installed-package/read-packed-peers.mts",
    "tests/installed-package/read-runtime-part.mts"];
  public static readonly fixtureOpenModule: string = "scripts/tests/installed-package/open-module.ts";
  public static readonly fixtureRuntimeModule: string = "scripts/tests/installed-package/read-runtime-part.mts";
  public static readonly fixturePeersModule: string = "scripts/tests/installed-package/read-packed-peers.mts";
  public static readonly fixtureRuntimeParts: readonly string[] = ["@noldova/git/runtime", "@noldova/git.github/runtime", "@noldova/git.azure-devops/runtime"];
  public static readonly fixtureContextUnread: string = "The installed-package test reads the lowest tested context from src/noldova.git.window/package.json's "
    + "@noldova/context.core peer range and the newest from the root manifest's pin, and couldn't read one of them.";
  public static readonly fixturePackArguments: readonly string[] = ["pack", "--ignore-scripts", "--silent"];
  public static readonly fixtureInstallArguments: readonly string[] = ["install", "--no-audit", "--no-fund", "--ignore-scripts"];
  public static readonly fixtureCompileArguments: readonly string[] = ["--noEmit", "--strict", "--allowImportingTsExtensions", "--module", "nodenext", "--moduleResolution", "nodenext",
    "--target", "es2023", "--types", "node"];
  public static readonly fixtureArchivesMissing: string = "_packages must hold the repository's ten archives; run npm run build first.";
  public static readonly fixturePeersMissing: string = "node_modules must hold Noldova Desktop's runtime and the packages it depends on; run npm ci first.";
  public static readonly fixtureNpmMissing: string = "Run it with npm test, which installs the fixture app through npm.";
  public static readonly fixturePeersRead: string = "Read each host window part's peer on the Git window part at the module's version, each window part's Angular peers "
    + `from its pins to the next major, no context package among the window parts' dependencies, and each package's peers on context's packages from a tested version to the pin's next minor.${Resources.lineEnd}`;
  public static readonly fixtureCompiled: string =
    `Compiled and ran the runtime parts' construction and the protocols' reading against the installed packages.${Resources.lineEnd}`;

  public static formatFixtureManifest(context: string): string {
    const dependencies = Object.fromEntries(Resources.fixtureContextPackages.map(t => [t, context]));
    return `${JSON.stringify({ name: "fixture-app", private: true, type: "module", dependencies }, null, Resources.jsonIndent)}${Resources.lineEnd}`;
  }

  public static formatFixtureContext(context: string): string {
    return `Installing the fixture app with context's packages at ${context}.${Resources.lineEnd}`;
  }

  public static formatPackageSpec(name: string, version: string): string {
    return `${name}@${version}`;
  }

  public static formatInstalledVersionMissing(file: string): string {
    return `${file} has no version, so the build can't keep the installed version when it installs its archives.`;
  }

  public static formatProcessStartFailed(command: string): string {
    return `"${command}" could not start.`;
  }

  public static formatProcessOutputTooLong(command: string, limit: number): string {
    return `"${command}" wrote more than ${limit} bytes.`;
  }

  public static formatCommand(program: string, parameters: readonly string[]): string {
    return [program, ...parameters].join(" ");
  }

  public static formatProcessTimeout(command: string, timeout: number): string {
    return `"${command}" did not finish within ${timeout} ms.`;
  }

  public static formatGitFailed(gitArguments: readonly string[], exitCode: number | null, errorOutput: string): string {
    return `"${Resources.gitCommand} ${gitArguments.join(" ")}" failed with exit code ${exitCode}: ${errorOutput}`;
  }

  public static formatNpmListUnreadable(listArguments: readonly string[], place: string, output: string): string {
    return `"${Resources.npmCommand} ${listArguments.join(" ")}" in ${place} gave no list to read: ${output}`;
  }

  public static formatNpmListFailed(listArguments: readonly string[], place: string, code: string, summary: string): string {
    return `"${Resources.npmCommand} ${listArguments.join(" ")}" in ${place} failed (${code}): ${summary}`;
  }

  public static formatNoCopyFound(name: string, place: string): string {
    return `npm ls found no ${name} in ${place}'s tree, so the check read nothing.${Resources.lineEnd}`;
  }

  public static formatOneCopyFound(name: string, place: string): string {
    return `Found one copy of ${name} in ${place}'s tree.${Resources.lineEnd}`;
  }

  public static formatCopiesFound(place: string, count: number, name: string, consequence: string): string {
    return `${Resources.capitalize(place)}'s tree holds ${count} copies of ${name}, ${consequence}:${Resources.lineEnd}`;
  }

  public static capitalize(text: string): string {
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  }

  public static formatCopyAt(version: string, folder: string): string {
    return `${Resources.indent}${version} at ${folder}${Resources.lineEnd}`;
  }

  public static formatCopyLine(source: string, name: string, entry: string): string {
    return `${source}\t${name}\t${entry}${Resources.lineEnd}`;
  }

  public static formatJsonValueNotObject(context: string): string {
    return `${context} must be an object.`;
  }

  public static formatJsonValueNotText(field: string): string {
    return `${field} must be text.`;
  }

  public static formatJsonPath(context: string, key: string): string {
    return `${context}${Resources.dot}${key}`;
  }

  public static formatExportsNotMapped(file: string): string {
    return `${file}'s ${Resources.exportsField} must map each subpath to a source.`;
  }

  public static formatExportNotSource(file: string, subpath: string): string {
    return `${file}'s export ${subpath} must name a ${Resources.typeScriptExtension} source.`;
  }

  public static formatDependenciesNotObject(file: string, field: string): string {
    return `${file}'s ${field} must be an object.`;
  }

  public static formatCompileFailed(folder: string, exitCode: number): string {
    return `Compiling ${folder} failed with exit code ${String(exitCode)}; TypeScript's errors are above.`;
  }

  public static formatArchiveInstallFailed(archives: readonly string[], exitCode: number | null, output: string): string {
    return `Installing the packed ${archives.join(", ")} failed with exit code ${String(exitCode)}:${Resources.lineEnd}${output}`;
  }

  public static formatPackFailed(packageName: string, exitCode: number | null, output: string): string {
    return `Packing ${packageName} failed with exit code ${exitCode}:${Resources.lineEnd}${output}`;
  }

  public static formatOwnPinDiffers(file: string, name: string, pin: string, version: string): string {
    return `${file} pins ${name} at ${pin}; the module's own packages are at its version, ${version}.`;
  }

  public static formatCompiledMissing(folder: string): string {
    return `${folder} doesn't exist; the package's TypeScript build writes it.`;
  }

  public static formatNoldovaDesktopMissing(file: string): string {
    return `${file} names no ${Resources.noldovaDesktopField} of the form >=<lowest> <first refused>.`;
  }

  public static formatModuleVersionMissing(file: string): string {
    return `${file} has no version.`;
  }

  public static formatVersionFileDiffers(file: string, found: string, versionFile: string, version: string): string {
    return `${file} has the version ${found}; the packages are at ${versionFile}'s version, ${version}.`;
  }

  public static formatManifestVersionDiffers(file: string, found: string, version: string): string {
    return `${file} has the version ${found}; the module's packages are at ${Resources.moduleFile}'s version, ${version}.`;
  }

  public static formatPrivatePackage(file: string): string {
    return `${file} is private, so it can't be packed for publishing.`;
  }

  public static formatJsonFileMalformed(file: string): string {
    return `${file} is not valid JSON.`;
  }

  public static formatJsonFileNotObject(file: string): string {
    return `${file} must be a JSON object.`;
  }

  public static formatImportUnpinned(name: string, file: string): string {
    return `The window part imports ${name}, which ${file} doesn't pin.`;
  }

  public static formatAngularCoreUnpinned(file: string): string {
    return `Every window part takes ${Resources.angularCore} as a peer, which ${file} doesn't pin.`;
  }

  public static formatPackageUnnamed(file: string): string {
    return `${file} has no name.`;
  }

  public static formatArchiveUnreadable(archive: string): string {
    return `${archive} could not be read as a gzipped archive.`;
  }

  public static formatArchiveEntryMalformed(archive: string, offset: number): string {
    return `${archive} has a malformed or truncated entry at offset ${offset}.`;
  }

  public static formatArchiveFolderMissing(folder: string): string {
    return `There is no folder ${folder} with the archives to release.`;
  }

  public static formatArchiveFindings(findings: readonly string[]): string {
    return findings.join(Resources.lineEnd);
  }

  public static formatArchiveManifestNotObject(context: string): string {
    return `${context} is not a JSON object.`;
  }

  public static formatArchiveMissing(folder: string, archiveName: string): string {
    return `${folder} lacks ${archiveName}.`;
  }

  public static formatArchiveUnexpected(folder: string, fileName: string, version: string): string {
    return `${folder} holds ${fileName}, which is not a package's archive at ${version}.`;
  }

  public static formatArchiveModuleNotObject(archiveName: string): string {
    return `${archiveName}'s ${Resources.archiveModuleEntry} is not a JSON object.`;
  }

  public static formatArchiveNoldovaDesktopUnranged(archiveName: string, named: string): string {
    return `${archiveName}'s ${Resources.archiveModuleEntry} names ${Resources.noldovaDesktopField} ${named}, not a range of the form >=<lowest> <first refused>.`;
  }

  public static formatArchiveNoldovaDesktopsDiffer(ranges: readonly string[]): string {
    return `The archives' ${Resources.moduleFile} files name different ${Resources.noldovaDesktopField} ranges, ${ranges.join(" and ")}; the repository's modules build against one.`;
  }

  public static formatArchiveManifestMissing(archiveName: string): string {
    return `${archiveName} has no ${Resources.archiveManifestEntry}.`;
  }

  public static formatArchiveManifestContext(archiveName: string): string {
    return `${archiveName} ${Resources.archiveManifestEntry}`;
  }

  public static formatArchiveFieldDiffers(archiveName: string, field: string, found: string, expected: string): string {
    return `${archiveName}: its ${field} is "${found}", not "${expected}".`;
  }

  public static formatArchiveOutsideScope(archiveName: string, name: string, scope: string): string {
    return `${archiveName}: ${name} is outside the scope ${scope}.`;
  }

  public static formatArchiveCommitDiffers(archiveName: string, found: unknown, commit: string): string {
    return `${archiveName}: its ${Resources.commitField} is ${found === undefined ? Resources.missingValue : JSON.stringify(found)}, not "${commit}"; a release builds its archives `
      + `from a clean clone of the commit, which each records as its ${Resources.commitField}.`;
  }

  public static formatArchiveMarkedPrivate(archiveName: string): string {
    return `${archiveName}: is marked private, so npm would refuse to publish it.`;
  }

  public static formatArchiveDependencyDiffers(archiveName: string, dependency: string, range: string, version: string): string {
    return `${archiveName}: its dependency ${dependency} is "${range}", not exactly "${version}".`;
  }

  public static formatArchiveExportsNothing(archiveName: string): string {
    return `${archiveName} exports nothing.`;
  }

  public static formatArchiveExportMissing(archiveName: string, subpath: string, target: string): string {
    return `${archiveName} exports ${subpath} as ${target}, which the archive lacks.`;
  }

  public static formatArchiveModuleMissing(archiveName: string): string {
    return `${archiveName} exports the module's parts but lacks ${Resources.moduleFile} at its root.`;
  }

  public static formatArchiveCorePeerDiffers(archiveName: string, name: string, pin: string, field: string, noldovaDesktop: string): string {
    return `${archiveName} names ${name} at ${pin} in ${field}, not at ${Resources.moduleFile}'s ${Resources.noldovaDesktopField}, ${noldovaDesktop}.`;
  }

  public static formatArchiveAngularPeerUnranged(archiveName: string, name: string, pin: string, field: string): string {
    return `${archiveName} names ${name} at ${pin} in ${field}, not at a range of the form >=<the Angular it builds with> <the next major>.`;
  }

  public static formatArchiveSiblingPeerDiffers(archiveName: string, peer: string, range: string, expected: string): string {
    return `${archiveName}: its peer ${peer} is "${range}", not "${expected}".`;
  }

  public static formatArchivePinInexact(archiveName: string, name: string, pin: string, field: string, isRanged: boolean): string {
    return `${archiveName} names ${name} at ${pin} in ${field}, not at one exact version${isRanged ? Resources.rangeAlternative : ''}.`;
  }

  public static formatArchivePeerNotOptional(archiveName: string, peer: string): string {
    return `${archiveName} doesn't mark its peer ${peer} optional, so an app's root install would take a second copy.`;
  }

  public static formatAngularEntriesMissing(entries: string): string {
    return `${entries} has no entry files to compile.`;
  }

  public static formatAngularCompileTimeout(sources: string, timeout: number): string {
    return `Compiling ${sources} with the Angular compiler did not finish within ${timeout} ms.`;
  }

  public static formatAngularCompileFailed(sources: string, exitCode: number | null, output: string): string {
    return `Compiling ${sources} with the Angular compiler failed with exit code ${exitCode}:${Resources.lineEnd}${output}`;
  }

  public static formatBinaryMissing(folder: string, packageName: string): string {
    return `Nothing at or above ${folder} holds ${packageName} to run; npm ci installs it.`;
  }

  public static formatBinaryManifestMalformed(manifest: string): string {
    return `${manifest} is not valid JSON.`;
  }

  public static formatBinaryCommandMissing(manifest: string, command: string): string {
    return `${manifest} names no ${command} command.`;
  }

  public static formatNextMinor(minor: number): string {
    return `0.${minor + 1}.0`;
  }

  public static formatSiblingRefused(major: number, minor: number): string {
    return `${major}.${minor + 1}.0`;
  }

  public static formatNextMajor(major: number): string {
    return `${major + 1}.0.0`;
  }

  public static formatRange(lowest: string, refused: string): string {
    return `>=${lowest} <${refused}`;
  }

  public static formatLocation(file: string, line: number): string {
    return `${file}:${line}`;
  }

  public static formatNoOnPush(count: number): string {
    return `No component in the ${count} source files sets OnPush change detection, Angular's default.${Resources.lineEnd}`;
  }

  public static formatOnPushFound(found: readonly string[]): string {
    return `${found.length} components set OnPush change detection, which Angular 22 makes the default; remove the option:${Resources.lineEnd}`
      + `${found.map(t => `${Resources.indent}${t}`).join(Resources.lineEnd)}${Resources.lineEnd}`;
  }

  public static formatClassMetadataSummary(calls: number, classes: number): string {
    return `Coverage ignores ${calls} compiler-generated class-metadata calls for ${classes} classes, which run only in development mode.`;
  }

  public static formatUnknownTestOptions(options: readonly string[], unknown: readonly string[]): string {
    return `npm test takes ${options.join(" and ")}, then any test files, not ${unknown.join(Resources.listSeparator)}.`;
  }

  public static formatUnlistedSlowFile(file: string, milliseconds: number): string {
    return `${file} took ${Resources.formatSeconds(milliseconds)}, over the 1 s a test file has, and README's list of test files over 1 second doesn't name it; npm run test:timing fails it if its median is over too.${Resources.lineEnd}`;
  }

  public static formatListedSlowFile(file: string, milliseconds: number, allowed: number): string {
    const time = `${file} took ${Resources.formatSeconds(milliseconds)}`;
    return milliseconds <= allowed ? `${time}, within the ${Resources.formatSeconds(allowed)} README's list of test files over 1 second gives it.${Resources.lineEnd}`
      : `${time}, over the ${Resources.formatSeconds(allowed)} README's list of test files over 1 second gives it; npm run test:timing fails it if its median is over that and the margin.${Resources.lineEnd}`;
  }

  public static formatTimingReport(suite: string, run: number): string {
    return `${suite}-${String(run)}.json`;
  }

  public static formatTimingMedian(file: string, median: number, limit: number, isOver: boolean): string {
    return `${isOver ? "OVER" : "ok"} ${file}: median ${Resources.formatSeconds(median)} of ${String(Resources.timingRuns)} runs, against ${Resources.formatSeconds(limit)}.`;
  }

  public static formatTimingSummary(files: number, over: number): string {
    return `Timing check: ${String(files)} test files, ${String(over)} over. A file's limit is 1 s, or the time README's list of test files over 1 second gives it plus ${String(Resources.timingMargin * 100)}%, against its median of ${String(Resources.timingRuns)} runs; it is apart from npm test, since its pass condition is a time.`;
  }

  public static formatSeconds(milliseconds: number): string {
    return `${(milliseconds / Resources.millisecondsPerSecond).toFixed(1)} s`;
  }

  public static formatTestTimesUnreadable(file: string): string {
    return `${file}, Vitest's JSON report of the run, isn't JSON or holds a test file without its name, start or end.`;
  }

  public static formatListedFileMissing(file: string): string {
    return `README's list of test files over 1 second names ${file}, which the run has no longer; take it off the list.${Resources.lineEnd}`;
  }

  public static formatNoGate(gate: string): string {
    return `--coverage.thresholds.${gate}=0`;
  }

  public static formatModuleProblem(folder: string, problem: string): string {
    return `${folder}: ${problem}`;
  }

  public static formatDeclarationTextBlank(field: string): string {
    return `module.json's ${field} must be text that is not blank.`;
  }

  public static formatDeclarationPartUnknown(part: string): string {
    return `module.json names an unknown part: ${part}.`;
  }

  public static formatDeclarationPartMissing(part: string, folder: string): string {
    return `module.json's part ${part} has no folder at ${folder}.`;
  }

  public static formatDeclarationDependencyInvalid(dependency: string): string {
    return `module.json names an invalid dependency: ${dependency}.`;
  }

  public static formatDeclarationDependencyInexact(dependency: string): string {
    return `module.json must name ${dependency} at an exact version in dependencies.`;
  }

  public static formatDeclarationKindUnknown(kind: string): string {
    return `module.json contributes an unknown kind: ${kind}.`;
  }

  public static formatDeclarationContributionInvalid(kind: string, name: string, id: string): string {
    return `module.json's ${kind} entry ${name} must have the form ${id}.<camelCaseName>.`;
  }

  public static formatDeclarationToolInvalid(name: string, prefix: string): string {
    return `module.json's tools entry ${name} must be a snake_case name of at most ${Resources.maximumToolNameLength} characters starting with ${prefix}.`;
  }

  public static formatDeclarationListInvalid(field: string): string {
    return `module.json's ${field} must be a list of names.`;
  }

  public static formatDeclarationListRepeats(field: string): string {
    return `module.json's ${field} lists a name twice.`;
  }

  public static formatManifestNameDiffers(packageName: string): string {
    return `The package's manifest must name it ${packageName}.`;
  }

  public static formatRootPinDiffers(name: string, manifest: string): string {
    return `${name} must be pinned at the same version in the root manifest and ${manifest}.`;
  }

  public static formatContextDependency(description: string, name: string): string {
    return `${description} must take ${name} as a peer of the form >=<lowest> <first refused>, not as a dependency: each of context's packages pins its `
      + `siblings exactly, so an exact dependency installs a second copy of context beside the app's.`;
  }

  public static formatWindowPeerInvalid(name: string): string {
    return `The window package's manifest's peerDependencies may hold only context's packages and the editor, each as >=<lowest> <first refused> to the next minor below 1.0 `
      + `or the next major from 1.0, which ${name} isn't.`;
  }

  public static formatRootPinOutsidePeer(manifest: string, name: string, range: string): string {
    return `The root manifest must pin ${name} in devDependencies inside ${manifest}'s peer range ${range}, so the build tests a version the package takes.`;
  }

  public static formatPeersNotObject(field: string): string {
    return `The package's manifest's ${field} must be an object.`;
  }

  public static formatCorePeerDiffers(name: string, range: string, field: string): string {
    return `The package's manifest must name ${name} at module.json's noldovaDesktop, ${range}, in ${field}.`;
  }

  public static formatPeerInexact(name: string, isRanged: boolean, field: string): string {
    return `The package's manifest must pin ${name} at an exact version${isRanged ? Resources.peerRangeAlternative : ''} in ${field}.`;
  }

  public static formatBuiltOutsideCore(description: string, name: string, pin: string, range: string): string {
    return `${description} builds against ${name} ${pin}, outside module.json's noldovaDesktop ${range}.`;
  }

  public static formatRootPinUnlisted(name: string): string {
    return `${name} is pinned in the root manifest, so a module's package manifest or window package manifest must list it.`;
  }

  public static formatPinsNotObject(description: string, field: string): string {
    return `${description}'s ${field} must be an object.`;
  }

  public static formatPinInexact(description: string, name: string, field: string): string {
    return `${description} must pin ${name} at an exact version in ${field}.`;
  }

  public static formatJsonUnreadable(path: string, error: unknown): string {
    return `Could not read ${path}: ${String(error)}`;
  }

  public static formatJsonNotObject(path: string): string {
    return `${path} must hold a JSON object.`;
  }
}
