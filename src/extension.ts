import * as vscode from 'vscode';
import { AutoCloseTabsManager, AutoCloseTabsStatusBar } from './autoCloseTabs';

// Global instances
let autoCloseManager: AutoCloseTabsManager | undefined;
let statusBarManager: AutoCloseTabsStatusBar | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Your extension is now active!');

    // Initialize auto-close tabs feature
    initializeAutoCloseTabs(context);

    // Listen for configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('kazuki.autoCloseTabs')) {
            handleConfigurationChange();
        }
    });

    context.subscriptions.push(configChangeListener);
}

function initializeAutoCloseTabs(context: vscode.ExtensionContext) {
    try {
        // Create the auto-close tabs manager
        autoCloseManager = new AutoCloseTabsManager(context);
        context.subscriptions.push(autoCloseManager);

        // Check if status bar should be shown
        const config = vscode.workspace.getConfiguration('kazuki');
        const showStatusBar = config.get('autoCloseTabs.showStatusBar', true);

        if (showStatusBar) {
            statusBarManager = new AutoCloseTabsStatusBar(autoCloseManager);
            context.subscriptions.push(statusBarManager);

            // Update status bar when configuration changes
            const statusUpdateListener = vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('kazuki.autoCloseTabs')) {
                    statusBarManager?.updateStatusBar();
                }
            });

            context.subscriptions.push(statusUpdateListener);
        }

        console.log('Auto-close tabs feature initialized successfully');
    } catch (error) {
        console.error('Failed to initialize auto-close tabs feature:', error);
        vscode.window.showErrorMessage('Failed to initialize auto-close tabs feature');
    }
}

function handleConfigurationChange() {
    const config = vscode.workspace.getConfiguration('kazuki');
    const showStatusBar = config.get('autoCloseTabs.showStatusBar', true);

    // Handle status bar visibility changes
    if (showStatusBar && !statusBarManager && autoCloseManager) {
        statusBarManager = new AutoCloseTabsStatusBar(autoCloseManager);
    } else if (!showStatusBar && statusBarManager) {
        statusBarManager.dispose();
        statusBarManager = undefined;
    }

    // Update status bar if it exists
    statusBarManager?.updateStatusBar();
}

export function deactivate() {
    // Cleanup is handled automatically by VS Code disposing context.subscriptions
    console.log('Your extension is now deactivated');
}

// Optional: Export functions for testing
export function getAutoCloseManager(): AutoCloseTabsManager | undefined {
    return autoCloseManager;
}

export function getStatusBarManager(): AutoCloseTabsStatusBar | undefined {
    return statusBarManager;
}