
const vscode = require('vscode');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function getTodayCommits(repositoryPath) {
    const { stdout } = await execFileAsync(
        'git',
        [
            'log',
            '--since=midnight',
            '--no-merges',
            '--pretty=format:%h%x09%aI%x09%s'
        ],
        {
            cwd: repositoryPath,
            windowsHide: true,
            maxBuffer: 5 * 1024 * 1024
        }
    );

    if (!stdout.trim()) {
        return [];
    }

    return stdout.split(/\r?\n/).map((line) => {
        const [hash, date, ...messageParts] = line.split('\t');

        return {
            hash,
            date,
            message: messageParts.join('\t')
        };
    });
}


function createDailyReport(commits, workNotes = '') {
    const today = new Date().toLocaleDateString();

    const commitSection = commits.length
        ? commits.map((commit) =>
            `- ${commit.message} (\`${commit.hash}\`)`
        ).join('\n')
        : '- No commits found for today.';

    const notesSection = workNotes.trim()
        ? workNotes
            .split(/\r?\n/)
            .map((note) => note.trim())
            .filter(Boolean)
            .map((note) => `- ${note}`)
            .join('\n')
        : '- No additional work notes added.';

    return `# Daily Developer Report — ${today}

## Git Activity
${commitSection}

## Completed
- Review the Git activity above and describe the completed work.

## Additional Work
${notesSection}

## In Progress
- Add any unfinished work.

## Blockers
- None reported.

## Next Steps
- Add your planned tasks.
`;
}


function activate(context) {
    const disposable = vscode.commands.registerCommand(
        'commitra.generateDailyReport',
        async () => {
            const folders = vscode.workspace.workspaceFolders;

            if (!folders || folders.length === 0) {
                vscode.window.showErrorMessage(
                    'Commitra: Open your project folder first.'
                );
                return;
            }

            const repositoryPath = folders[0].uri.fsPath;

            try {
				const commits = await getTodayCommits(repositoryPath);
				const workNotes = await vscode.window.showInputBox({
					prompt: 'What else did you work on today?',
					placeHolder: 'Meetings, debugging, code reviews, etc.',
					ignoreFocusOut: true
				});

				if (workNotes === undefined) {
					return;
				}
                const report = createDailyReport(commits,workNotes);

                const document = await vscode.workspace.openTextDocument({
                    language: 'markdown',
                    content: report
                });

                await vscode.window.showTextDocument(document);

                vscode.window.showInformationMessage(
                    `Commitra generated a report from ${commits.length} commit(s).`
                );
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : String(error);

                vscode.window.showErrorMessage(
                    `Commitra could not read Git history: ${message}`
                );
            }
        }
    );

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
