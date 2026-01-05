import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { PicGoService } from './services/PicGoService';

export class VditorProvider implements vscode.CustomTextEditorProvider {

    public static readonly viewType = 'vditor.editor';
    private readonly picGoService: PicGoService;

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.picGoService = new PicGoService();
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            enableCommandUris: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        };

        // Note: CustomTextEditorProvider does not allow setting enableFindWidget on the panel options directly after creation easily.
        // However, for CustomTextEditor, the options are passed during registration or handled by VS Code.
        // Actually, CustomTextEditorProvider does not support enableFindWidget in the same way as WebviewPanel created via window.createWebviewPanel.
        // But we can try to see if we can just rely on browser find, or if there is another way.
        // Wait, for Custom Editors, the find widget should be enabled by default if the webview supports it?
        // Let's check if we can just remove this block and if it works, or if we need to do something else.
        // The error is because we are trying to assign to a readonly property.
        // We should not be assigning to webviewPanel.options here.

        // Let's revert the invalid assignment.
        // To enable find, we might need to implement a custom find provider or rely on browser default.
        // But wait, the user said shortcuts are OCCUPIED. This implies VS Code is capturing them but not doing anything?
        // Or the webview is capturing them?

        // If we look at VS Code API, CustomTextEditorProvider resolveCustomTextEditor gives us a WebviewPanel.
        // We cannot change its options property.

        // Let's just remove the invalid code for now to fix the build.
        // And we will research if there is a way to enable find widget for custom editors.
        // Actually, for custom editors, the find widget is usually handled by the extension implementing a search provider or using the webview's find.

        // Reverting the options assignment.

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        let isFromWebview = false;

        // Listen for messages from the Webview
        webviewPanel.webview.onDidReceiveMessage(async (e: any) => {
            switch (e.type) {
                case 'update':
                    isFromWebview = true;
                    await this.updateTextDocument(document, e.content);
                    isFromWebview = false;
                    break;
                case 'uploadImage':
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Uploading image...",
                        cancellable: false
                    }, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
                        try {
                            // e.fileData is expected to be an array or buffer-like object from the webview
                            const buffer = Buffer.from(e.fileData);

                            // Calculate MD5
                            const md5 = crypto.createHash('md5').update(buffer).digest('hex');

                            // Get original extension
                            const originalExt = path.extname(e.fileName);
                            // Get original name without extension for alt text
                            const originalName = path.basename(e.fileName, originalExt);

                            // Construct new filename: [MD5][Ext]
                            const newFileName = `${md5}${originalExt}`;

                            // Pass the parent directory of the document as the baseDir for the temp file
                            // This allows picgo-plugin-folder-name to detect the correct folder context
                            const docDir = path.dirname(document.fileName);
                            const url = await this.picGoService.uploadImage(newFileName, buffer, docDir);

                            webviewPanel.webview.postMessage({ type: 'uploadSuccess', id: e.id, url, originalName });
                            vscode.window.showInformationMessage(`Image uploaded successfully: ${newFileName}`);
                        } catch (err: any) {
                            webviewPanel.webview.postMessage({ type: 'uploadError', id: e.id, error: err.message });
                            vscode.window.showErrorMessage(`PicGo Upload Failed: ${err.message}`);
                        }
                    });
                    break;
                case 'ready':
                    // Webview is ready, send initial content
                    webviewPanel.webview.postMessage({
                        type: 'update',
                        content: document.getText()
                    });
                    break;
                case 'switchEditor':
                    await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
                    break;
            }
        });

        // Listen for changes in the document (e.g. from other editors or external changes)
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            if (e.document.uri.toString() === document.uri.toString()) {
                // Avoid updating the webview if the change came from the webview itself
                if (!isFromWebview) {
                    webviewPanel.webview.postMessage({
                        type: 'update',
                        content: document.getText()
                    });
                }
            }
        });

        // Clean up subscription when panel is closed
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Initial content
        // We use a small timeout or wait for webview to be ready in a real app, 
        // but here we rely on the webview requesting init or just sending it blindly.
        // Better: The webview script should send a 'ready' message, but for now we'll just send it.
        // To be safe, we can also send it when the webview script loads (if we had that logic).
        // For this step, we'll just leave the HTML script placeholder.
    }

    private async updateTextDocument(document: vscode.TextDocument, content: string) {
        const edit = new vscode.WorkspaceEdit();

        // Replace the entire document content
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );

        edit.replace(document.uri, fullRange, content);

        await vscode.workspace.applyEdit(edit);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Use index.min.js and index.css as requested
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'index.min.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'index.css'));

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet" />
                <title>Vditor</title>
                <style>
                    html, body, #vditor {
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: hidden;
                    }
                </style>
            </head>
            <body>
                <div id="vditor"></div>
                <script src="${scriptUri}"></script>
                <script>
                    const vscode = acquireVsCodeApi();
                    let vditor;

                    // Error logging
                    window.onerror = function(message, source, lineno, colno, error) {
                        vscode.postMessage({
                            type: 'uploadError',
                            id: Date.now(),
                            error: 'Webview Error: ' + message + ' at ' + source + ':' + lineno + ':' + colno
                        });
                    };

                    // Detect VS Code theme
                    const isDark = document.body.classList.contains('vscode-dark') ||
                                   document.body.classList.contains('vscode-high-contrast');

                    try {
                        // Initialize Vditor
                        vditor = new Vditor('vditor', {
                        height: '100%',
                        mode: 'wysiwyg', // Instant Rendering mode
                        theme: isDark ? 'dark' : 'classic',
                        preview: {
                            theme: {
                                current: isDark ? 'dark' : 'classic',
                            },
                            hljs: {
                                lineNumber: true,
                                style: 'atom-one-dark',
                            },
                        },
                        outline: {
                            enable: true,
                            position: 'right',
                        },
                        toolbar: [
                            'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|',
                            'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
                            'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
                            'upload', 'record', 'table', '|',
                            'undo', 'redo', '|',
                            'fullscreen', 'edit-mode',
                            {
                                name: 'more',
                                toolbar: [
                                    'both',
                                    'code-theme',
                                    'content-theme',
                                    'export',
                                    'outline',
                                    'preview',
                                    'devtools',
                                    'info',
                                    'help',
                                ],
                            },
                            '|',
                            {
                                name: 'switch-editor',
                                tip: 'Switch to Default Editor',
                                icon: '<svg t="1763954105129" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1635" width="14" height="14"><path d="M128 85.333333a42.666667 42.666667 0 0 0-42.666667 42.666667v768a42.666667 42.666667 0 0 0 42.666667 42.666667h768a42.666667 42.666667 0 0 0 42.666667-42.666667V128a42.666667 42.666667 0 0 0-42.666667-42.666667H128z m0-85.333333h768a128 128 0 0 1 128 128v768a128 128 0 0 1-128 128H128a128 128 0 0 1-128-128V128a128 128 0 0 1 128-128z" fill="#606266" p-id="1636"></path><path d="M753.365333 522.368L662.869333 431.786667a42.666667 42.666667 0 0 1 60.330667-60.330667l120.661333 120.704a42.666667 42.666667 0 0 1 0 60.330667L723.2 673.194667a42.666667 42.666667 0 0 1-60.330667-60.330667l90.453334-90.496zM291.328 522.368L381.866667 612.864a42.666667 42.666667 0 1 1-60.330667 60.330667L200.832 552.533333a42.666667 42.666667 0 0 1 0-60.330666l120.704-120.704A42.666667 42.666667 0 1 1 381.866667 431.829333L291.328 522.368z" fill="#606266" p-id="1637"></path><path d="M426.673489 750.538066m11.042946-41.212836l110.429459-412.128352q11.042946-41.212835 52.255782-30.16989l0 0q41.212835 11.042946 30.169889 52.255782l-110.429459 412.128352q-11.042946 41.212835-52.255782 30.16989l0 0q-41.212835-11.042946-30.169889-52.255782Z" fill="#606266" p-id="1638"></path></svg>',
                                click: () => {
                                    vscode.postMessage({ type: 'switchEditor' });
                                }
                            }
                        ],
                        cache: {
                            enable: false,
                        },
                        input: (value) => {
                            vscode.postMessage({
                                type: 'update',
                                content: value
                            });
                        },
                        upload: {
                            accept: 'image/*',
                            handler: (files) => {
                                if (files.length === 0) return;
                                
                                const file = files[0];
                                const reader = new FileReader();
                                
                                reader.onload = (e) => {
                                    const arrayBuffer = e.target.result;
                                    const uint8Array = new Uint8Array(arrayBuffer);
                                    // Convert to regular array for JSON serialization
                                    const data = Array.from(uint8Array);
                                    
                                    vscode.postMessage({
                                        type: 'uploadImage',
                                        fileName: file.name,
                                        fileData: data,
                                        id: Date.now() // Simple ID for matching response
                                    });
                                };
                                
                                reader.readAsArrayBuffer(file);
                                
                                // Return null to prevent default Vditor upload behavior
                                return null;
                            }
                        },
                        after: () => {
                            vscode.postMessage({ type: 'ready' });
                        }
                    });
                    } catch (e) {
                        vscode.postMessage({
                            type: 'uploadError',
                            id: Date.now(),
                            error: 'Vditor Init Error: ' + e.message
                        });
                    }

                    // Handle messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'update':
                                if (vditor) {
                                    vditor.setValue(message.content);
                                }
                                break;
                            case 'uploadSuccess':
                                if (vditor) {
                                    // Insert markdown image syntax with original filename as alt text
                                    const altText = message.originalName || 'image';
                                    const imageMarkdown = \`![\${altText}](\${message.url})\`;
                                    vditor.insertValue(imageMarkdown);
                                }
                                break;
                            case 'uploadError':
                                console.error('Upload failed:', message.error);
                                // Optionally show error in editor
                                break;
                        }
                    });
                </script>
            </body>
            </html>`;
    }
}
