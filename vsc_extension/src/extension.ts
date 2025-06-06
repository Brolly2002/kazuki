import * as vscode from 'vscode';
import { AutoCloseTabsManager } from './autoCloseTabs';
import { FolderGeneratorManager } from './folderGenerator';
import { RagManager } from './ragManager';


// Global instances
let autoCloseManager: AutoCloseTabsManager | undefined;
let folderGeneratorManager: FolderGeneratorManager | undefined;
let ragManager: RagManager | undefined;


export function activate(context: vscode.ExtensionContext) {
    console.log('Kazuki extension is now active!');
    
    // Initialize managers
    autoCloseManager = new AutoCloseTabsManager(context);
    folderGeneratorManager = new FolderGeneratorManager(context);
    ragManager = new RagManager(context);
    
    // Add to context subscriptions for proper cleanup
    context.subscriptions.push(autoCloseManager, folderGeneratorManager, ragManager);
    
    // Register existing commands
    const showInfoCommand = vscode.commands.registerCommand('kazuki.showInfo', () => {
        const config = vscode.workspace.getConfiguration('kazuki');
        const isEnabled = config.get('autoCloseTabs.enabled', false);
        const delay = config.get('autoCloseTabs.delay', 100);
        
        vscode.window.showInformationMessage(
            `Auto-Close Tabs: ${isEnabled ? 'ON' : 'OFF'} | Delay: ${delay}ms`
        );
    });
    
    // Register folder generation commands
    const generateFolderCommand = vscode.commands.registerCommand('kazuki.generateFolder', async () => {
        await folderGeneratorManager?.generateFolderStructure();
    });
    
    const generateFolderInCurrentCommand = vscode.commands.registerCommand('kazuki.generateFolderInCurrent', async () => {
        await folderGeneratorManager?.generateFolderInCurrentWorkspace();
    });
    
    context.subscriptions.push(showInfoCommand, generateFolderCommand, generateFolderInCurrentCommand);
}

export function deactivate() {
    console.log('Kazuki extension is now deactivated');
    if (autoCloseManager) {
        autoCloseManager.dispose();
        autoCloseManager = undefined;
    }
    if (folderGeneratorManager) {
        folderGeneratorManager.dispose();
        folderGeneratorManager = undefined;
    }
    if (ragManager) {
        ragManager.dispose();
        ragManager = undefined;
    }
}

