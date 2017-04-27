import * as vscode from 'vscode';
import {Server} from './server';
import {CheckingMode, FileRoi, RoiRange} from 'lean-client-js-node';

enum RoiMode {
    Nothing,
    VisibleFiles,
    // VisibleLines, // TODO(gabriel): depends on https://github.com/Microsoft/vscode/issues/14756
    OpenFiles,
    ProjectFiles,
}

export class RoiManager implements vscode.Disposable {
    mode: RoiMode;
    server: Server;
    statusBarItem: vscode.StatusBarItem;

    constructor(server: Server) {
        this.server = server;
        this.statusBarItem = vscode.window.createStatusBarItem();
        this.checkVisibleFiles();
    }

    compute(): Thenable<FileRoi[]> {
        // improve after https://github.com/Microsoft/vscode/issues/14756
        let visibleRanges: {[fileName: string]: RoiRange[]} = {};
        for (let editor of vscode.window.visibleTextEditors) {
            if (editor.document.languageId === "lean")
                visibleRanges[editor.document.fileName] =
                    [{begin_line: 1, end_line: editor.document.lineCount}];
        }

        let roi: FileRoi[] = [];
        if (this.mode == RoiMode.ProjectFiles) {
            return vscode.workspace.findFiles("**/*.lean").then(files => {
                for (let f of files) {
                    let path = f.fsPath;
                    if (visibleRanges[path]) {
                        roi.push({file_name: path, ranges: visibleRanges[path]});
                    } else {
                        roi.push({file_name: path, ranges: []});
                    }
                }
                return roi;
            });
        } else {
            for (let d of vscode.workspace.textDocuments) {
                let path = d.fileName;
                if (visibleRanges[path]) {
                    roi.push({file_name: path, ranges: visibleRanges[path]});
                } else {
                    roi.push({file_name: path, ranges: []});
                }
            }
            return new Promise((resolve) => resolve(roi));
        }
    }

    modeString(): CheckingMode {
        switch (this.mode) {
            case RoiMode.Nothing: return "nothing";
            case RoiMode.VisibleFiles: return "visible-files";
            case RoiMode.OpenFiles: return "open-files";
            case RoiMode.ProjectFiles: return "open-files";
            default: throw "unknown roi mode";
        }
    }

    send() { this.compute().then(roi => this.server.roi(this.modeString(), roi)) }

    checkNothing() {
        this.mode = RoiMode.Nothing;
        this.statusBarItem.text = "(no checking)";
        this.send();
    }
    checkVisibleFiles() {
        this.mode = RoiMode.VisibleFiles;
        this.statusBarItem.text = "(checking visible files)";
        this.send();
    }
    checkOpenFiles() {
        this.mode = RoiMode.OpenFiles;
        this.statusBarItem.text = "(checking open files)";
        this.send();
    }
    checkProjectFiles() {
        this.mode = RoiMode.ProjectFiles;
        this.statusBarItem.text = "(checking all files)";
        this.send();
    }

    dispose() {
        this.statusBarItem.dispose()
    }
}