// Native startup adaptation based on the MIT-licensed DeepSeek Harness desktop shell.
// Only the two declared ASAR members are replaced; original payload is retained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const asar=require('@electron/asar');
const {Pickle}=require(path.join(path.dirname(require.resolve('@electron/asar')),'pickle.js'));
const SUPPORTED_SHA='04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const safe=v=>JSON.stringify(v).replace(/</g,'\\u003c');
function locations(options){
 if(!options.appDir)throw Error('--app-dir is required');
 const appDir=fs.realpathSync(options.appDir),target=path.join(appDir,'resources','app.asar');
 if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw Error('Expected a regular resources/app.asar');
 const state=path.resolve(options.stateDir||path.join(__dirname,'.local-state'));
 if(state===path.dirname(target)||state===appDir)throw Error('Keep state/backups outside the DSH installation');
 return {appDir,target,state,backup:path.join(state,'app.original.asar'),patched:path.join(state,'app.jarvis.asar'),manifest:path.join(state,'native-manifest.json')};
}
function build(options){
const paths=locations(options);fs.mkdirSync(paths.state,{recursive:true});
let image=fs.readFileSync(paths.target);let sourceHash=sha(image);const deployedSha=sourceHash;
if(sourceHash!==SUPPORTED_SHA){
 if(!fs.existsSync(paths.manifest))throw Error('Unsupported DSH build. Only the documented 0.2.1-rc.3 archive is supported.');
 const previous=JSON.parse(fs.readFileSync(paths.manifest,'utf8'));
 if(![previous.patchedSha256,previous.previousPatchedSha256].includes(sourceHash)||previous.originalSha256!==SUPPORTED_SHA)throw Error('DSH was updated or changed; refusing to stack patches.');
 image=fs.readFileSync(paths.backup);sourceHash=sha(image);
}
if(sourceHash!==SUPPORTED_SHA)throw Error('Original archive does not match the supported build');
const backup=paths.backup;if(!fs.existsSync(backup))fs.writeFileSync(backup,image,{flag:'wx'});
if(sha(fs.readFileSync(backup))!==SUPPORTED_SHA)throw Error('Backup integrity failed; refusing to replace it');
const original=backup;
const hdr=asar.getRawHeader(original);const files=[];
function walk(node,parts=[]){for(const [name,e]of Object.entries(node.files||{})){if(e.files)walk(e,[...parts,name]);else files.push({path:[...parts,name].join('/'),entry:e});}}walk(hdr.header);
const mainPath='lib/main.js',htmlPath='dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/index.html';
function entry(name){const f=files.find(f=>f.path===name);if(!f||f.entry.unpacked||f.entry.link)throw Error('Unsupported member '+name);return f.entry;}
function bytes(name){const e=entry(name),start=8+hdr.headerSize+Number(e.offset);return image.subarray(start,start+e.size);}
let main=bytes(mainPath).toString('utf8'),html=bytes(htmlPath).toString('utf8');
function once(s,from,to){if(s.split(from).length!==2)throw Error('Patch anchor is not unique: '+from.slice(0,70));return s.replace(from,to);}
// Process-scoped claim: reloads/new windows in this process never replay the cold boot.
main=once(main,'async function serveWebDocument(request, root) {','async function serveWebDocument(request, root, jarvisColdBoot = false) {');
const contentStart='\tconst content = pathname === "/" || pathname === "/index.html" ? body.toString().replace("<head>", "<head><script>globalThis.__DSH_BOOT_READY__ = Promise.withResolvers()<\\/script>") : new Uint8Array(body);';
const contentReplace=`\tlet jarvisConfig = {};
\tif (pathname === "/" || pathname === "/index.html") { try { const raw = await readFile(join(process.env.DSH_HOME || join(homedir(), ".dsh"), "dsh-startup.json"), "utf8"); if (raw.length < 65536) { const value = JSON.parse(raw); if (value && typeof value === "object" && !Array.isArray(value)) jarvisConfig = value; } } catch {} }
\tconst jarvisHead = "<head><script>globalThis.__DSH_BOOT_READY__ = Promise.withResolvers();globalThis.__JARVIS_COLD_BOOT__=" + JSON.stringify(jarvisColdBoot) + ";globalThis.__JARVIS_STARTUP_OVERRIDES__=" + JSON.stringify(jarvisConfig).replace(/</g, "\\\\u003c") + ";<\\/script>";
\tconst content = pathname === "/" || pathname === "/index.html" ? body.toString().replace("<head>", jarvisHead) : new Uint8Array(body);`;
main=once(main,contentStart,contentReplace);
main=once(main,'\tprotocol.handle(SCHEME, (request) => {','\tlet jarvisColdBootClaimed = false; // JARVIS native boot v1\n\tprotocol.handle(SCHEME, (request) => {');
const serveApp='\t\t\tif (url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/assets/") || ["/favicon.svg", "/manifest.webmanifest"].includes(url.pathname)) return serveWebDocument(request, join(resources.dsh, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist"));';
const serveReplace=`\t\t\tif (url.pathname === "/" || url.pathname === "/index.html") { const cold = request.method === "GET" && !jarvisColdBootClaimed; if (request.method === "GET") jarvisColdBootClaimed = true; return serveWebDocument(request, join(resources.dsh, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist"), cold); }
\t\t\tif (url.pathname.startsWith("/assets/") || ["/favicon.svg", "/manifest.webmanifest"].includes(url.pathname)) return serveWebDocument(request, join(resources.dsh, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist"));`;
main=once(main,serveApp,serveReplace);
main=once(main,'\t\tmainWindow = window;','\t\tmainWindow = window;\n\t\twindow.once("ready-to-show", () => { if (!quitting && !window.isDestroyed() && !isMandatory() && welcomeWindow === undefined) { window.maximize(); window.show(); } });');
main=once(main,'\t\twidth: 1280,','\t\tbackgroundColor: "#01070e",\n\t\twidth: 1280,');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'defaults.json'),'utf8'));
config.bootWithInitialization=true;if(options.name)config.identity=options.name;
const audio={};for(const name of ['bgm-v2.mp3','voice-us-ready.mp3',...Array.from({length:6},(_,i)=>'voice-us-'+(i+1)+'.mp3')])audio[name]='data:audio/mpeg;base64,'+fs.readFileSync(path.join(__dirname,name)).toString('base64');
const css=fs.readFileSync(path.join(__dirname,'splash.css'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'splash.js'),'utf8');
const preamble=`window.__JARVIS_NATIVE_BOOT__=true;window.__DSH_STARTUP_BOOT__='native-cold-boot';window.__DSH_STARTUP__=Object.assign(${safe(config)},window.__JARVIS_STARTUP_OVERRIDES__||{});window.__JARVIS_AUDIO_ASSETS__=${safe(audio)};
window.__JARVIS_NATIVE_REPLAY__=function(){window.__DSH_STARTUP_LOADED__=false;window.__DSH_STARTUP_SKIP__=false;${runtime}\n};
if(window.__JARVIS_COLD_BOOT__===true){window.__JARVIS_NATIVE_REPLAY__();}else{window.__DSH_STARTUP_SKIP__=true;window.__DSH_STARTUP_LOADED__=true;window.__DSH_STARTUP_API__={replay:window.__JARVIS_NATIVE_REPLAY__,finish:function(){},skip:function(){}};}`;
if(/<\/script/i.test(preamble))throw Error('Unsafe embedded script terminator');
html=once(html,'<head>','<head>\n<style id="jarvis-native-style">'+css+'</style>');
html=once(html,'<body>','<body>\n<script id="jarvis-native-boot">'+preamble+'</script>');
const replacements=new Map([[mainPath,Buffer.from(main)],[htmlPath,Buffer.from(html)]]);
// Append changed members; all original payload bytes and unpacked metadata remain intact.
const payload=image.subarray(8+hdr.headerSize);let tail=payload.length;const added=[];
for(const [name,content]of replacements){const e=entry(name);e.offset=String(tail);e.size=content.length;e.integrity={algorithm:'SHA256',hash:sha(content),blockSize:4194304,blocks:[]};for(let i=0;i<content.length;i+=4194304)e.integrity.blocks.push(sha(content.subarray(i,i+4194304)));tail+=content.length;added.push(content);}
const pickle=Pickle.createEmpty();pickle.writeString(JSON.stringify(hdr.header));const header=pickle.toBuffer();const size=Pickle.createEmpty();size.writeUInt32(header.length);
const patched=Buffer.concat([size.toBuffer(),header,payload,...added]);const output=paths.patched;fs.writeFileSync(output,patched);
asar.uncacheAll();const verify=asar.getRawHeader(output);let unchanged=0;
function at(image,h,name){let n=h.header;for(const part of name.split('/'))n=n.files[part];return image.subarray(8+h.headerSize+Number(n.offset),8+h.headerSize+Number(n.offset)+n.size);}
const originalHeader=asar.getRawHeader(original);
for(const f of files){if(f.entry.unpacked||f.entry.link)continue;const old=at(image,originalHeader,f.path),now=at(patched,verify,f.path);if(replacements.has(f.path)){if(!now.equals(replacements.get(f.path)))throw Error('Replacement mismatch '+f.path);}else{if(!old.equals(now))throw Error('Unrelated member changed '+f.path);unchanged++;}}
const manifest={version:1,applicationVersion:'0.2.1-rc.3',target:paths.target,originalSha256:sourceHash,patchedSha256:sha(patched),previousPatchedSha256:deployedSha===SUPPORTED_SHA?null:deployedSha,backup,patchedFile:output,modifiedMembers:[...replacements.keys()],unchangedPackedFiles:unchanged};
fs.writeFileSync(paths.manifest,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'work/native/patched-main.js'),main);fs.writeFileSync(path.join(root,'work/native/patched-index.html'),html);
return manifest;

}
function inspect(options){
 const paths=locations(options);const manifest=JSON.parse(fs.readFileSync(paths.manifest,'utf8'));
 if(path.resolve(manifest.target).toLowerCase()!==paths.target.toLowerCase()||manifest.originalSha256!==SUPPORTED_SHA)throw Error('State belongs to another application');
 if(sha(fs.readFileSync(paths.backup))!==SUPPORTED_SHA)throw Error('Backup integrity failed');
 const current=sha(fs.readFileSync(paths.target));
 if(![manifest.originalSha256,manifest.patchedSha256,manifest.previousPatchedSha256].includes(current))throw Error('DSH was updated or changed. Refusing to overwrite it.');
 return {paths,manifest,current};
}
function assertStopped(appDir){
 if(process.platform!=='win32')throw Error('Native deployment is supported on Windows only');
 const command='$p=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "DeepSeek Harness.exe" -and $_.ExecutablePath -eq $env:JARVIS_APP_EXE }); if($p.Count){exit 9}';
 const r=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{env:{...process.env,JARVIS_APP_EXE:path.join(appDir,'DeepSeek Harness.exe')},windowsHide:true,encoding:'utf8'});
 if(r.error)throw r.error;if(r.status!==0)throw Error('Fully exit DSH, including its tray process, before installation or restore');
}
function deploy(options,restore=false){
 const {paths,manifest,current}=inspect(options);assertStopped(paths.appDir);
 const expected=restore?manifest.originalSha256:manifest.patchedSha256;
 if(current===expected)return {changed:false,restored:restore};
 const source=restore?paths.backup:paths.patched;
 if(sha(fs.readFileSync(source))!==expected)throw Error('Deployment source integrity failed');
 const staging=paths.target+'.jarvis-stage';fs.copyFileSync(source,staging);
 if(sha(fs.readFileSync(staging))!==expected)throw Error('Staging integrity failed');
 fs.renameSync(staging,paths.target);
 if(sha(fs.readFileSync(paths.target))!==expected)throw Error('Deployment integrity failed');
 return {changed:true,restored:restore};
}
module.exports={build,inspect,deploy,locations};
if(require.main===module){try{
 const [action,...args]=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){if(!args[i+1])throw Error('Missing option value');const key={'--app-dir':'appDir','--state-dir':'stateDir','--name':'name'}[args[i]];if(!key)throw Error('Unknown option '+args[i]);options[key]=args[i+1];}
 if(action==='build'){const m=build(options);console.log(JSON.stringify({modifiedMembers:m.modifiedMembers,unchangedPackedFiles:m.unchangedPackedFiles,patchedFile:m.patchedFile},null,2));}
 else if(action==='check'){const r=inspect(options);console.log(JSON.stringify({installed:r.current===r.manifest.patchedSha256,backupValid:true}));}
 else if(action==='install')console.log(JSON.stringify(deploy(options)));
 else if(action==='restore')console.log(JSON.stringify(deploy(options,true)));
 else throw Error('Usage: node native-patch.cjs build|install|restore|check --app-dir "path" [--state-dir "path"] [--name "Commander"]');
}catch(e){console.error(e.message);process.exitCode=1;}}
