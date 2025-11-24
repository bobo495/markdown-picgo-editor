import * as vscode from 'vscode';
import { VditorProvider } from './VditorProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-vditor-wsl" is now active!');

    // Register the Vditor custom editor provider
    const provider = new VditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(VditorProvider.viewType, provider, {
            webviewOptions: {
                enableFindWidget: true,
                retainContextWhenHidden: true
            }
        })
    );
}

export function deactivate() { }
