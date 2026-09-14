import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Called before uploading, including dry runs. Fail closed if identifiers are unconfigured.
export function checkBuildPrivacy(directory) {
  execFileSync(process.env.YOUGAME_PYTHON || 'python3', [
    fileURLToPath(new URL('./build_privacy.py', import.meta.url)), 'scan', directory,
  ], {stdio: 'inherit'});
}
