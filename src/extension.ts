import * as vscode from 'vscode';
import { AutoCloseTabsManager } from './autoCloseTabs';

// Global instances
let autoCloseManager: AutoCloseTabsManager | undefined;

export function activate(context: vscode.ExtensionContext) {

    console.log('Kazuki Auto-Close Tabs extension is now active!');
    // Initialize the auto-close tabs manager
    autoCloseManager = new AutoCloseTabsManager(context);
    
    // Add to context subscriptions for proper cleanup
    context.subscriptions.push(autoCloseManager);
    
    // Register additional commands if needed
    const showInfoCommand = vscode.commands.registerCommand('kazuki.showInfo', () => {
        const config = vscode.workspace.getConfiguration('kazuki');
        const isEnabled = config.get('autoCloseTabs.enabled', false);
        const delay = config.get('autoCloseTabs.delay', 100);
        
        vscode.window.showInformationMessage(
            `Auto-Close Tabs: ${isEnabled ? 'ON' : 'OFF'} | Delay: ${delay}ms`
        );
    });
    
    context.subscriptions.push(showInfoCommand);
}


export function deactivate() {
    // Cleanup is handled automatically by VS Code disposing context.subscriptions
    console.log('Your extension is now deactivated');
    if (autoCloseManager) {
        autoCloseManager.dispose();
        autoCloseManager = undefined;
    }
}

