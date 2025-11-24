import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as child_process from 'child_process';
import * as util from 'util';

const exec = util.promisify(child_process.exec);

export class PicGoService {

    constructor() { }

    /**
     * Uploads an image using PicGo CLI in WSL.
     * @param fileName The name of the file to be saved temporarily.
     * @param fileData The binary data of the image.
     * @param baseDir Optional directory to save the temporary file in. Defaults to os.tmpdir().
     * @returns The URL of the uploaded image.
     */
    public async uploadImage(fileName: string, fileData: Uint8Array, baseDir?: string): Promise<string> {
        // 1. Get PicGo path from configuration
        const config = vscode.workspace.getConfiguration('vditor');
        const picgoPath = config.get<string>('picgoPath') || 'picgo';

        // 2. Create a temporary file path
        // If baseDir is provided, use it; otherwise use os.tmpdir()
        const tempDir = baseDir || os.tmpdir();
        const tempFilePath = path.join(tempDir, fileName);

        try {
            // 3. Write file data to temp file
            await fs.promises.writeFile(tempFilePath, fileData);

            // 4. Execute PicGo command
            // Command: [picgoPath] upload [tempFilePath]
            const command = `${picgoPath} upload "${tempFilePath}"`;
            const { stdout, stderr } = await exec(command);

            if (stderr) {
                // PicGo might output warnings to stderr, log them but don't fail immediately if stdout has result
                console.warn(`PicGo stderr: ${stderr}`);
            }

            // 5. Parse result
            // Extract the last line or find a URL in the output
            const lines = stdout.trim().split('\n');
            const lastLine = lines[lines.length - 1].trim();

            // Simple URL validation regex
            const urlRegex = /(https?:\/\/[^\s]+)/;
            const match = lastLine.match(urlRegex);

            if (match) {
                return match[0];
            } else {
                // Fallback: try to find URL in the whole stdout if last line failed
                const allMatch = stdout.match(urlRegex);
                if (allMatch) {
                    return allMatch[0];
                }
                throw new Error(`Could not find image URL in PicGo output. Output: ${stdout}`);
            }

        } catch (error) {
            console.error('PicGo upload failed:', error);
            throw error;
        } finally {
            // 6. Cleanup: Delete the temporary file
            try {
                if (fs.existsSync(tempFilePath)) {
                    await fs.promises.unlink(tempFilePath);
                }
            } catch (cleanupError) {
                console.error('Failed to cleanup temp file:', cleanupError);
            }
        }
    }
}
