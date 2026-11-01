import './package-windows.mjs';
import './build-icon.mjs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
if(process.platform!=='win32')throw Error('Build the desktop release on Windows.');
const compiler=path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
if(!fs.existsSync(compiler))throw Error('.NET Framework C# compiler not found.');
function run(command,args){const result=spawnSync(command,args,{stdio:'inherit',windowsHide:true});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run(compiler,['/nologo','/target:winexe','/codepage:65001','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/win32icon:'+path.resolve('release/LUMA/LUMA.ico'),'/out:'+path.resolve('release/LUMA/LUMA.exe'),path.resolve('scripts/Launcher.cs')]);
run(process.env.PYTHON||'python',['scripts/package-release.py']);
