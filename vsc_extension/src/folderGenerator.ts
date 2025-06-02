import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface FolderStructure {
    [key: string]: string[];
}

interface GenerateResponse {
    success: boolean;
    structure?: FolderStructure;
    error?: string;
}

export class FolderGeneratorManager implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private statusBarItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.text = "$(folder) Generate";
        this.statusBarItem.tooltip = "Generate Folder Structure";
        this.statusBarItem.command = 'kazuki.generateFolder';
        
        this.updateStatusBar();
        context.subscriptions.push(this.statusBarItem);
    }

    private updateStatusBar() {
        const config = vscode.workspace.getConfiguration('kazuki');
        const showStatusBar = config.get('folderGenerator.showStatusBar', true);
        
        if (showStatusBar) {
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    public async generateFolderStructure() {
        try {
            // Get user input for the prompt
            const prompt = await vscode.window.showInputBox({
                prompt: 'Describe the project structure you want to generate',
                placeHolder: 'e.g., Create a React TypeScript app with Redux and authentication',
                value: ''
            });

            if (!prompt) {
                return;
            }

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating folder structure...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 20, message: "Contacting AI service..." });

                // Get Flask backend URL from configuration
                const config = vscode.workspace.getConfiguration('kazuki');
                const backendUrl = config.get('folderGenerator.backendUrl', 'http://localhost:5000');

                try {
                    progress.report({ increment: 40, message: "Processing request..." });

                    // Call your Flask backend
                    const response = await axios.post(`${backendUrl}/generate-structure`, {
                        prompt: prompt
                    }, {
                        timeout: 30000 // 30 second timeout
                    });

                    progress.report({ increment: 30, message: "Creating folders..." });

                    const data: GenerateResponse = response.data;
                    
                    if (data.success && data.structure) {
                        // Let user choose where to create the structure
                        const folderUri = await vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: 'Select Folder to Generate Structure'
                        });

                        if (folderUri && folderUri[0]) {
                            await this.createFolderStructure(folderUri[0].fsPath, data.structure);
                            progress.report({ increment: 10, message: "Done!" });
                            
                            vscode.window.showInformationMessage(
                                'Folder structure generated successfully!',
                                'Open Folder'
                            ).then(selection => {
                                if (selection === 'Open Folder') {
                                    vscode.commands.executeCommand('vscode.openFolder', folderUri[0]);
                                }
                            });
                        }
                    } else {
                        throw new Error(data.error || 'Failed to generate structure');
                    }
                } catch (error) {
                    console.error('Error generating folder structure:', error);
                    let errorMessage = 'Failed to generate folder structure';
                    
                    if (axios.isAxiosError(error)) {
                        if (error.code === 'ECONNREFUSED') {
                            errorMessage = 'Cannot connect to backend service. Make sure Flask server is running on ' + backendUrl;
                        } else if (error.response) {
                            errorMessage = `Backend error: ${error.response.status} - ${error.response.statusText}`;
                        }
                    }
                    
                    vscode.window.showErrorMessage(errorMessage);
                }
            });

        } catch (error) {
            console.error('Error in generateFolderStructure:', error);
            vscode.window.showErrorMessage('An unexpected error occurred');
        }
    }

    public async generateFolderInCurrentWorkspace() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('No workspace folder is open. Please open a folder first.');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        
        // Get user input for the prompt
        const prompt = await vscode.window.showInputBox({
            prompt: 'Describe the project structure you want to add to current workspace',
            placeHolder: 'e.g., Add authentication module with login and signup components',
            value: ''
        });

        if (!prompt) {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating folder structure in current workspace...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 20, message: "Contacting AI service..." });

            const config = vscode.workspace.getConfiguration('kazuki');
            const backendUrl = config.get('folderGenerator.backendUrl', 'http://localhost:5000');

            try {
                progress.report({ increment: 40, message: "Processing request..." });

                const response = await axios.post(`${backendUrl}/generate-structure`, {
                    prompt: prompt
                }, {
                    timeout: 30000
                });

                progress.report({ increment: 30, message: "Creating folders..." });

                const data: GenerateResponse = response.data;
                
                if (data.success && data.structure) {
                    await this.createFolderStructure(workspaceFolder.uri.fsPath, data.structure);
                    progress.report({ increment: 10, message: "Done!" });
                    
                    vscode.window.showInformationMessage(
                        'Folder structure added to workspace successfully!'
                    );
                } else {
                    throw new Error(data.error || 'Failed to generate structure');
                }
            } catch (error) {
                console.error('Error generating folder structure:', error);
                let errorMessage = 'Failed to generate folder structure';
                
                if (axios.isAxiosError(error)) {
                    if (error.code === 'ECONNREFUSED') {
                        errorMessage = 'Cannot connect to backend service. Make sure Flask server is running on ' + backendUrl;
                    }
                }
                
                vscode.window.showErrorMessage(errorMessage);
            }
        });
    }


    private async createFolderStructure(basePath: string, structure: FolderStructure) {
        const createdPaths = new Set<string>();
        const queue: Array<{ element: string; path: string }> = [];

        console.log('Creating folder structure at:', basePath);
        console.log('Structure:', JSON.stringify(structure, null, 2));

        const orderedStructure = new Map<string, string[]>(Object.entries(structure));
        
        for (const [itemName, children] of orderedStructure) {

            if (createdPaths.has(itemName)) {
                continue;
            }

            const fullPath = path.join(basePath, itemName);

            queue.push({
                element: itemName,
                path: fullPath
            });

            console.log(`Processing item: ${itemName} at path: ${fullPath}`);
            console.log(`Children: ${JSON.stringify(children)}`);
        
            // Process queue using BFS
            while (queue.length > 0) {
                const { element, path: currentPath } = queue.shift()!;
                const itemPath = path.join(currentPath, element);
                
                if (createdPaths.has(element)) {
                    continue;
                }

                createdPaths.add(element);
                
                const children = structure[element]

                const isFile = /\.[^/.]+$/.test(element);

                try {
                    if (isFile) {
                        if (!fs.existsSync(currentPath)) {
                            fs.writeFileSync(currentPath, '', 'utf8');
                        }
                    }
                    else {
                        if (!fs.existsSync(itemPath)) {
                            fs.mkdirSync(itemPath, { recursive: true });
                            createdPaths.add(itemName);
                        }
                        // Add children to queue for next level processing
                        for (const childName of Object.keys(children)) {
                            const childPath = path.join(itemPath, childName);
                            queue.push({
                                element: childName,
                                path: childPath // Child's parent path is current item's path
                            });
                        }
                    }
                }
                catch (error) {
                    console.error(`Error creating ${itemPath}:`, error);
                }
            }
        }
    }


    dispose() {
        this.statusBarItem.dispose();
    }
}