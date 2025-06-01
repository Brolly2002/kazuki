import * as vscode from 'vscode';

export class AutoCloseTabsManager {
    private isEnabled: boolean = false;
    private disposables: vscode.Disposable[] = [];
    private activeEditorChangeListener: vscode.Disposable | undefined;

    constructor(private context: vscode.ExtensionContext) {
        this.loadSettings();
        this.registerCommands();
    }

    private loadSettings() {
        const config = vscode.workspace.getConfiguration('kazuki');
        this.isEnabled = config.get('autoCloseTabs.enabled', false);
        
        if (this.isEnabled) {
            this.enableAutoClose();
        }
    }

    private registerCommands() {
        // Command to toggle auto-close feature
        const toggleCommand = vscode.commands.registerCommand(
            'kazuki.toggleAutoCloseTabs',
            () => this.toggleAutoClose()
        );

        // Command to manually trigger close other tabs
        const closeOthersCommand = vscode.commands.registerCommand(
            'kazuki.closeOtherTabs',
            () => this.closeOtherTabs()
        );

        this.disposables.push(toggleCommand, closeOthersCommand);
    }

    private async toggleAutoClose() {
        this.isEnabled = !this.isEnabled;
        
        // Update workspace configuration
        const config = vscode.workspace.getConfiguration('kazuki');
        await config.update('autoCloseTabs.enabled', this.isEnabled, vscode.ConfigurationTarget.Global);

        if (this.isEnabled) {
            this.enableAutoClose();
            vscode.window.showInformationMessage('Auto-close tabs: Enabled');
        } else {
            this.disableAutoClose();
            vscode.window.showInformationMessage('Auto-close tabs: Disabled');
        }
    }

    private enableAutoClose() {
        if (this.activeEditorChangeListener) {
            return; // Already enabled
        }

        // Listen for active editor changes
        this.activeEditorChangeListener = vscode.window.onDidChangeActiveTextEditor(
            (editor) => {
                if (editor && this.isEnabled) {
                    // Small delay to ensure the editor is fully loaded
                    setTimeout(() => this.closeOtherTabs(), 100);
                }
            }
        );

        // Also listen for when tabs are opened
        const tabChangeListener = vscode.window.tabGroups.onDidChangeTabs(
            (event) => {
                if (this.isEnabled && event.opened.length > 0) {
                    setTimeout(() => this.closeOtherTabs(), 100);
                }
            }
        );

        this.disposables.push(this.activeEditorChangeListener, tabChangeListener);
    }

    private disableAutoClose() {
        if (this.activeEditorChangeListener) {
            this.activeEditorChangeListener.dispose();
            this.activeEditorChangeListener = undefined;
        }
    }

    private async closeOtherTabs() {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return;
            }

            const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
            if (!activeTabGroup) {
                return;
            }

            // Find the active tab
            const activeTab = activeTabGroup.tabs.find(tab => tab.isActive);
            if (!activeTab) {
                return;
            }

            // Get all other tabs in the active group
            const otherTabs = activeTabGroup.tabs.filter(tab => !tab.isActive);
            
            if (otherTabs.length === 0) {
                return;
            }

            // Close other tabs
            await vscode.window.tabGroups.close(otherTabs);

        } catch (error) {
            console.error('Error closing other tabs:', error);
            // Fallback method using workbench commands
            await this.fallbackCloseOtherTabs();
        }
    }

    private async fallbackCloseOtherTabs() {
        try {
            // Alternative approach using workbench commands
            await vscode.commands.executeCommand('workbench.action.closeOtherEditors');
        } catch (error) {
            console.error('Fallback close other tabs failed:', error);
        }
    }

    // Method to get current status for status bar or other UI elements
    public getStatus(): { enabled: boolean; activeTabsCount: number } {
        const activeTabGroup = vscode.window.tabGroups.activeTabGroup;
        const activeTabsCount = activeTabGroup ? activeTabGroup.tabs.length : 0;
        
        return {
            enabled: this.isEnabled,
            activeTabsCount
        };
    }

    public dispose() {
        this.disableAutoClose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
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
        "command": "kazuki.toggleAutoCloseTabs",
        "title": "Toggle Auto-Close Other Tabs",
        "category": "Kazuki"
    },
    {
        "command": "kazuki.closeOtherTabs",
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

// Status bar integration (optional)
export class AutoCloseTabsStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    
    constructor(private manager: AutoCloseTabsManager) {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            100
        );
        this.statusBarItem.command = 'kazuki.toggleAutoCloseTabs';
        this.updateStatusBar();
        this.statusBarItem.show();
    }

    public updateStatusBar() {
        const status = this.manager.getStatus();
        const icon = status.enabled ? '$(close-all)' : '$(circle-outline)';
        const text = `${icon} Auto-Close: ${status.enabled ? 'ON' : 'OFF'}`;
        
        this.statusBarItem.text = text;
        this.statusBarItem.tooltip = status.enabled 
            ? 'Auto-close other tabs is enabled. Click to disable.'
            : 'Auto-close other tabs is disabled. Click to enable.';
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}