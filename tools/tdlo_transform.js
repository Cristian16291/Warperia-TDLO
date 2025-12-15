const fs=require('fs');
const path=require('path');
function copyDir(src,dst){if(!fs.existsSync(dst))fs.mkdirSync(dst,{recursive:true});for(const e of fs.readdirSync(src,{withFileTypes:true})){const s=path.join(src,e.name);const d=path.join(dst,e.name);if(e.isDirectory()){copyDir(s,d);}else{fs.copyFileSync(s,d);}}}
function replaceInFile(p,rep){let c=fs.readFileSync(p,'utf8');for(const [a,b] of rep){c=c.replaceAll(a,b);}fs.writeFileSync(p,c);}
const upstream=path.join(process.cwd(),'upstream');
const out=path.join(process.cwd(),'app');
if(fs.existsSync(out))fs.rmSync(out,{recursive:true,force:true});
copyDir(path.join(upstream,'src'),path.join(out,'src'));
copyDir(path.join(upstream,'public'),path.join(out,'public'));
const rep=[["Warperia","Warperia-TDLO"],["Sign in","Iniciar sesión"],["Login","Acceder"],["Username","Usuario"],["Password","Contraseña"],["Servers","Servidores"],["Refresh","Actualizar"],["Search","Buscar"],["Download","Descargar"],["Update","Actualizar"],["Install","Instalar"],["Settings","Ajustes"],["Error","Error"],["Warning","Aviso"],["Success","Correcto"],["Addons","Addons"],["Launch","Iniciar"],["Restart","Reiniciar"]];
function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory()){walk(f);}else{if(/\.(js|jsx|ts|tsx|html|css)$/.test(e.name)){replaceInFile(f,rep);}}}}
walk(out);
const indexHtml=path.join(out,'public','index.html');
if(fs.existsSync(indexHtml)){replaceInFile(indexHtml,[["<title>Warperia","<title>Warperia-TDLO"]]);}
