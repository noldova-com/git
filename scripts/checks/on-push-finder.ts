/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { Resources } from "../resources.ts";

export class OnPushFinder {
  public static find(root: string, files: readonly string[]): readonly string[] {
    return files.flatMap(t => {
      const file = path.join(root, t);
      return OnPushFinder.findIn(t, ts.createSourceFile(file, readFileSync(file, Resources.encoding), ts.ScriptTarget.Latest, true));
    });
  }

  private static findIn(file: string, source: ts.SourceFile): readonly string[] {
    const names = new Set<string>();
    const namespaces = new Set<string>();
    for (const statement of source.statements)
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === Resources.angularCore) {
        const bindings = statement.importClause?.namedBindings;
        if (bindings !== undefined && ts.isNamespaceImport(bindings))
          namespaces.add(bindings.name.text);
        for (const element of bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements : [])
          if ((element.propertyName ?? element.name).text === Resources.componentDecorator)
            names.add(element.name.text);
      }

    const found: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isDecorator(node) && ts.isCallExpression(node.expression) && OnPushFinder.isComponent(node.expression.expression, names, namespaces)) {
        const options = node.expression.arguments.at(0);
        for (const property of options !== undefined && ts.isObjectLiteralExpression(options) ? options.properties : [])
          if (ts.isShorthandPropertyAssignment(property) && OnPushFinder.readKey(property.name) === Resources.changeDetectionOption
            || ts.isPropertyAssignment(property) && OnPushFinder.readKey(property.name) === Resources.changeDetectionOption && OnPushFinder.isOnPush(property.initializer))
            found.push(Resources.formatLocation(file, source.getLineAndCharacterOfPosition(property.getStart(source)).line + 1));
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    return found;
  }

  private static isComponent(callee: ts.Node, names: ReadonlySet<string>, namespaces: ReadonlySet<string>): boolean {
    return ts.isIdentifier(callee) && names.has(callee.text)
      || ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && namespaces.has(callee.expression.text) && callee.name.text === Resources.componentDecorator;
  }

  private static readKey(key: ts.Node): string | null {
    return ts.isIdentifier(key) || ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key) ? key.text : null;
  }

  private static isOnPush(value: ts.Node): boolean {
    return ts.isIdentifier(value) && value.text === Resources.onPushMember
      || ts.isPropertyAccessExpression(value) && value.name.text === Resources.onPushMember
      || ts.isElementAccessExpression(value) && OnPushFinder.readKey(value.argumentExpression) === Resources.onPushMember
      || ts.isNumericLiteral(value) && Number(value.text) === Resources.onPushValue;
  }
}
