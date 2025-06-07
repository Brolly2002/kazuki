import * as vscode from 'vscode';
import * as ts from 'typescript';

export interface UnusedImport {
    start: number;
    end: number;
    importName: string;
    line: number;
}

export class UnusedImportsManager {
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.registerCommands();
    }

    private registerCommands() {
        const removeUnusedImportsCommand = vscode.commands.registerCommand(
            'kazuki.removeUnusedImports',
            () => this.removeUnusedImportsHandler()
        );

        this.disposables.push(removeUnusedImportsCommand);
    }

    private async removeUnusedImportsHandler() {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        
        if (!this.isSupportedFile(document.languageId)) {
            vscode.window.showErrorMessage('This command only works with JavaScript/TypeScript files');
            return;
        }

        const text = document.getText();
        
        try {
            const sourceFile = this.createSourceFile(document, text);
            const unusedImports = this.findUnusedImports(sourceFile, text);
            
            if (unusedImports.length === 0) {
                vscode.window.showInformationMessage('No unused imports found');
                return;
            }

            await this.applyRemovalEdits(document, unusedImports);
            vscode.window.showInformationMessage(`Removed ${unusedImports.length} unused import(s)`);
            
        } catch (error) {
            vscode.window.showErrorMessage(`Error processing file: ${(error as any).message}`);
        }
    }

    private isSupportedFile(languageId: string): boolean {
        return ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(languageId);
    }

    private createSourceFile(document: vscode.TextDocument, text: string): ts.SourceFile {
        const scriptKind = this.getScriptKind(document.languageId);
        
        return ts.createSourceFile(
            document.fileName,
            text,
            ts.ScriptTarget.Latest,
            true,
            scriptKind
        );
    }

    private getScriptKind(languageId: string): ts.ScriptKind {
        if (languageId.includes('jsx') || languageId.includes('react')) {
            return languageId.includes('typescript') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
        }
        return languageId.includes('typescript') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    }

    private findUnusedImports(sourceFile: ts.SourceFile, text: string): UnusedImport[] {
        const imports = this.collectImports(sourceFile);
        const usedIdentifiers = this.collectUsedIdentifiers(sourceFile);
        
        return this.filterUnusedImports(imports, usedIdentifiers, text);
    }

    private collectImports(sourceFile: ts.SourceFile) {
        const imports: Array<{
            node: ts.ImportDeclaration;
            importedNames: string[];
            start: number;
            end: number;
        }> = [];

        function visitImports(node: ts.Node) {
            if (ts.isImportDeclaration(node)) {
                const importClause = node.importClause;
                const importedNames: string[] = [];
                
                if (importClause) {
                    // Default import (import React from 'react')
                    if (importClause.name) {
                        importedNames.push(importClause.name.text);
                    }
                    
                    // Named imports (import { useState, useEffect } from 'react')
                    if (importClause.namedBindings) {
                        if (ts.isNamedImports(importClause.namedBindings)) {
                            importClause.namedBindings.elements.forEach(element => {
                                importedNames.push(element.name.text);
                                // Handle aliased imports (import { useState as state } from 'react')
                                if (element.propertyName) {
                                    importedNames.push(element.propertyName.text);
                                }
                            });
                        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
                            // Namespace import (import * as React from 'react')
                            importedNames.push(importClause.namedBindings.name.text);
                        }
                    }
                }

                imports.push({
                    node,
                    importedNames,
                    start: node.getFullStart(),
                    end: node.getEnd()
                });
            }
            
            ts.forEachChild(node, visitImports);
        }

        visitImports(sourceFile);
        return imports;
    }

    private collectUsedIdentifiers(sourceFile: ts.SourceFile): Set<string> {
        const usedIdentifiers = new Set<string>();

        function visitNode(node: ts.Node) {
            // Skip import declarations to avoid false positives
            if (ts.isImportDeclaration(node)) {
                return;
            }

            if (ts.isIdentifier(node)) {
                usedIdentifiers.add(node.text);
            }

            // Handle JSX elements
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tagName = node.tagName;
                if (ts.isIdentifier(tagName)) {
                    usedIdentifiers.add(tagName.text);
                }
            }

            ts.forEachChild(node, visitNode);
        }

        visitNode(sourceFile);
        return usedIdentifiers;
    }

    private filterUnusedImports(
        imports: Array<{ node: ts.ImportDeclaration; importedNames: string[]; start: number; end: number; }>,
        usedIdentifiers: Set<string>,
        text: string
    ): UnusedImport[] {
        const unusedImports: UnusedImport[] = [];

        for (const importInfo of imports) {
            const { node, importedNames, start, end } = importInfo;
            
            // Check if it's a side-effect import (import './styles.css')
            if (importedNames.length === 0) {
                continue; // Keep side-effect imports
            }

            // Check if any imported name is used
            const isUsed = importedNames.some(name => usedIdentifiers.has(name));
            
            if (!isUsed) {
                const line = text.substring(0, start).split('\n').length;
                const importText = importedNames.join(', ');
                
                unusedImports.push({
                    start,
                    end,
                    importName: importText,
                    line
                });
            }
        }

        return unusedImports;
    }

    private async applyRemovalEdits(
        document: vscode.TextDocument, 
        unusedImports: UnusedImport[]
    ): Promise<void> {
        const edit = new vscode.WorkspaceEdit();

        // Sort by position (descending) to avoid messing up offsets while deleting
        unusedImports.sort((a, b) => b.start - a.start);
        console.log(`Found ${unusedImports.length} unused imports to remove.`);
        console.log(unusedImports);

        for (const unusedImport of unusedImports) {
            // Get the position of the start of the unused import
            const startPos = document.positionAt(unusedImport.start);

            // Get the entire line range (including the line break)
            const line = document.lineAt(startPos.line);
            const range = line.rangeIncludingLineBreak;

            // Delete the entire line containing the unused import
            edit.delete(document.uri, range);
        }

        await vscode.workspace.applyEdit(edit);
    }


    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}