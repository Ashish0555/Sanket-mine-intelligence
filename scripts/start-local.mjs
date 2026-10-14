import './sites-env.mjs';
import {copyFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const config=fileURLToPath(new URL('../dist/server/wrangler.json',import.meta.url));
const env=fileURLToPath(new URL('../.env',import.meta.url));
if(!existsSync(config))throw new Error('Build the app first with npm run build.');
if(!existsSync(env))copyFileSync(new URL('../.env.example',import.meta.url),env);
const cli=new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url);
const child=spawn(process.execPath,[fileURLToPath(cli),'dev','--config',config,'--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--inspector-port','0','--env-file',env,...process.argv.slice(2)],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
