const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=__dirname;
const files=['host.js','client.js','splash.js','splash.css','cordis.patch.yml','LICENSE','THIRD_PARTY.md','bgm-v2.mp3',...['1','2','3','4','5','6','ready'].map(i=>'voice-us-'+i+'.mp3')];
for(const f of files)if(!fs.existsSync(path.join(root,f)))throw Error('Missing '+f+'; generate speech first');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'dsh-jarvis-package-'));
const out=path.join(root,'artifacts');fs.mkdirSync(out,{recursive:true});
const pkg={name:'dsh-startup-screen',version:'1.1.2-jarvis.5',description:'JARVIS-style DSH startup overlay and settings',type:'module',main:'host.js',exports:{'.':'./host.js','./client':'./client.js','./package.json':'./package.json'},license:'MIT',repository:{type:'git',url:'https://github.com/hadesybil-hub/dsh-jarvis-startup.git'},dsh:{bundle:{patch:'./cordis.patch.yml'},client:{inject:['@deepseek-ai/dsh-client-ui-settings'],platform:'web'}}};
try{
 for(const f of files)fs.copyFileSync(path.join(root,f),path.join(stage,f));
 fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify(pkg,null,2));
 // npm's JavaScript entry avoids shell interpolation of filenames and directories.
 const npm=process.env.npm_execpath;if(!npm)throw Error('Run this through npm run pack:plugin');
 const r=cp.spawnSync(process.execPath,[npm,'pack','--ignore-scripts','--pack-destination',out],{cwd:stage,stdio:'inherit',windowsHide:true});
 if(r.status!==0)throw Error('npm pack failed');
}finally{
 const resolved=fs.realpathSync(stage),temp=fs.realpathSync(os.tmpdir());
 if(path.dirname(resolved)!==temp||!path.basename(resolved).startsWith('dsh-jarvis-package-'))throw Error('Unexpected temporary directory');
 fs.rmSync(resolved,{recursive:true,force:true});
}
