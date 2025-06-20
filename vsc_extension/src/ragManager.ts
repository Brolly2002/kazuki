import * as vscode from 'vscode';
import axios from 'axios';

export class RagManager {
    private disposables: vscode.Disposable[] = [];

    constructor(private context: vscode.ExtensionContext) {
        this.registerCommands();
    }

    private registerCommands() {

        const updateRagCommand = vscode.commands.registerCommand(
            'kazuki.updateRag',
            () => this.updateRagHandler()
        );

        const queryRagCommand = vscode.commands.registerCommand(
            'kazuki.queryRag',
            () => this.queryRagHandler()
        );

        this.disposables.push(updateRagCommand, queryRagCommand);

    }


    private async updateRagHandler() {

        const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select PDF',
            filters: {
                'PDF Files': ['pdf']
            }
        });

        if (!fileUris || fileUris.length === 0) {
            vscode.window.showErrorMessage('No PDF selected.');
            return;
        }

        const pdfPath = fileUris[0].fsPath;

        const config = vscode.workspace.getConfiguration('kazuki');
        const backendUrl = config.get<string>('rag.backendUrl', 'http://localhost:5000');

        try {

            // You may need to replace with a proper axios `FormData` handling depending on your backend
            await axios.post(`${backendUrl}/upload`, {
                pdf_path: pdfPath,
            });

            vscode.window.showInformationMessage(`PDF uploaded !!.`);
        } 
        catch (error) {
            vscode.window.showErrorMessage('Failed to upload PDF: ' + (error as any).message);
        }

    }

    private async queryRagHandler() {
        const userQuery = await vscode.window.showInputBox({
            prompt: 'Enter your query'
        });

        if (!userQuery) {
            vscode.window.showErrorMessage('Query is required.');
            return;
        }
        const config = vscode.workspace.getConfiguration('kazuki');
        const backendUrl = config.get<string>('rag.backendUrl', 'http://localhost:5000');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ increment: 0, message: "Searching knowledge base..." });
                
                // Check for cancellation
                if (token.isCancellationRequested) {
                    return;
                }

                const res = await axios.post(`${backendUrl}/query`, {
                    query: userQuery
                }, {
                    // Optional: Add timeout and cancellation support
                    timeout: 120000, // 120 seconds timeout
                    signal: token.isCancellationRequested ? new AbortController().signal : undefined
                });

                progress.report({ increment: 50, message: "Processing response..." });

                const answer = res.data.answer || '[No answer returned]';
                
                progress.report({ increment: 100, message: "Complete!" });

                // Show results in output channel
                const outputChannel = vscode.window.createOutputChannel('Kazuki RAG');
                outputChannel.clear();
                outputChannel.appendLine(`🧠 Query: ${userQuery}`);
                outputChannel.appendLine(`📘 Answer:\n${answer}`);
                outputChannel.show(true);

            } catch (error) {
                if (axios.isCancel(error)) {
                    vscode.window.showInformationMessage('Query was cancelled.');
                } else {
                    vscode.window.showErrorMessage('Failed to query RAG backend: ' + (error as any).message);
                }
            }
        });

    }


    public dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

}