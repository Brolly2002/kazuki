import * as vscode from 'vscode';

export class AutoCloseTabsManager {
    private disposables: vscode.Disposable[] = [];
    private activeEditorChangeListener: vscode.Disposable | undefined;
    private statusBarItem: vscode.StatusBarItem | undefined;
    private closeTimeout: NodeJS.Timeout | undefined;
    private currentActiveEditor: vscode.TextEditor | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.loadSettings();
        this.registerCommands();
        this.createStatusBarItem();
        this.updateStatusBar();
    }

    private loadSettings() {
        const config = vscode.workspace.getConfiguration('kazuki');
        const isEnabled = config.get('autoCloseTabs.enabled', false);
        
        if (isEnabled) {
            this.enableAutoClose();
        }
        else {
            this.disableAutoClose();
        }
    }

    private registerCommands() {

        // Command to auto-close tabs
        const toggleCommand = vscode.commands.registerCommand(
            'kazuki.AutoCloseTabs',
            () => this.autoCloseHandler()
        );

        // Command to manually trigger close other tabs
        const closeOthersCommand = vscode.commands.registerCommand(
            'kazuki.ManualCloseTabs',
            () => this.manualCloseHandler()
        );

         // Listen for configuration changes
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('kazuki.autoCloseTabs')) {
                this.loadSettings();
                this.updateStatusBar();
            }
        });

        this.disposables.push(toggleCommand, closeOthersCommand, configChangeListener);
    }

    private async autoCloseHandler() {
        const config = vscode.workspace.getConfiguration('kazuki');
        await config.update('autoCloseTabs.enabled', true, vscode.ConfigurationTarget.Global);
        this.enableAutoClose();
        vscode.window.showInformationMessage('Auto-Close Other Tabs: Enabled');
        this.updateStatusBar();        
    }

    private async manualCloseHandler() {
        const config = vscode.workspace.getConfiguration('kazuki');
        await config.update('autoCloseTabs.enabled', false, vscode.ConfigurationTarget.Global);
        
        this.disableAutoClose();
        vscode.window.showInformationMessage('Auto-Close Other Tabs: Disabled');
        this.updateStatusBar();
    }

    private enableAutoClose() {
        if (this.activeEditorChangeListener) {
            return; // Already enabled
        }

        this.activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(
            (editor) => this.onActiveEditorChanged(editor)
        );
        
        this.disposables.push(this.activeEditorChangeListener);
        console.log('Auto-close tabs enabled');
    }
    
    private disableAutoClose() {
        if (this.activeEditorChangeListener) {
            this.activeEditorChangeListener.dispose();
            this.activeEditorChangeListener = undefined;
        }
        
        // Clear any pending timeout
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = undefined;
        }
        
        console.log('Auto-close tabs disabled');
    }

    private onActiveEditorChanged(editor: vscode.TextEditor | undefined) {
        const config = vscode.workspace.getConfiguration('kazuki');
        const isEnabled = config.get('autoCloseTabs.enabled', false);
        
        if (!editor || !isEnabled) {
            return;
        }

        // Clear any existing timeout
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
        }

        // Store the current active editor
        this.currentActiveEditor = editor;

        // Set up delayed closing
        const delay = config.get('autoCloseTabs.delay', 100);

        this.closeTimeout = setTimeout(() => {
            this.closeOtherTabs(editor);
        }, delay);
    }

    private async closeOtherTabs(keepEditor: vscode.TextEditor) {
        try {
            const allTabs = vscode.window.tabGroups.all;
            
            for (const tabGroup of allTabs) {
                const tabsToClose: vscode.Tab[] = [];
                
                for (const tab of tabGroup.tabs) {
                    if (!tab.isActive) {
                        tabsToClose.push(tab);
                    }
                }

                // Close tabs in batches to avoid overwhelming VS Code
                if (tabsToClose.length > 0) {
                    await vscode.window.tabGroups.close(tabsToClose);
                }
            }
        } catch (error) {
            console.error('Error closing other tabs:', error);
            vscode.window.showErrorMessage('Failed to close other tabs');
        }
    }

    private createStatusBarItem() {
        const config = vscode.workspace.getConfiguration('kazuki');
        const showStatusBar = config.get('autoCloseTabs.showStatusBar', true);
        
        if (showStatusBar) {
            this.statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right, 
                100
            );
            this.statusBarItem.command = 'kazuki.AutoCloseTabs';
            this.statusBarItem.tooltip = 'Click to toggle Auto-Close Other Tabs';
            this.disposables.push(this.statusBarItem);
        }
    }

    public updateStatusBar() {
        if (!this.statusBarItem) return;

        const config = vscode.workspace.getConfiguration('kazuki');
        const showStatusBar = config.get('autoCloseTabs.showStatusBar', true);
        const isEnabled = config.get('autoCloseTabs.enabled', false);

        if (showStatusBar) {
            this.statusBarItem.text = isEnabled ? '$(close-all) Auto-Close: ON' : '$(close-all) Auto-Close: OFF';
            this.statusBarItem.backgroundColor = isEnabled ? 
                new vscode.ThemeColor('statusBarItem.warningBackground') : 
                undefined;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    public dispose() {
        // Clean up all disposables
        this.disableAutoClose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }
    }
}

// Configuration schema for package.json
export const autoCloseTabsConfiguration = {
    "kazuki.autoCloseTabs.enabled": {
        "type": "boolean",
        "default": false,
        "description": "Enable automatic closing of other tabs when switching to a new tab"
    },
    "kazuki.autoCloseTabs.delay": {
        "type": "number",
        "default": 100,
        "description": "Delay in milliseconds before closing other tabs"
    }
};


// Commands for package.json
export const autoCloseTabsCommands = [
    {
        "command": "kazuki.AutoCloseTabs",
        "title": "Toggle Auto-Close Other Tabs",
        "category": "Kazuki"
    },
    {
        "command": "kazuki.ManualCloseTabs",
        "title": "Close Other Tabs (Manual)",
        "category": "Kazuki"
    }
];


// Example usage in your main extension file (extension.ts)
export function activateAutoCloseTabs(context: vscode.ExtensionContext): AutoCloseTabsManager {
    const autoCloseManager = new AutoCloseTabsManager(context);
    
    // Add to context subscriptions for proper cleanup
    context.subscriptions.push(autoCloseManager);
    
    return autoCloseManager;
}
