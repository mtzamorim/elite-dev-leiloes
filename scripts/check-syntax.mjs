import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(dir,item.name)):[path.join(dir,item.name)]);}
let errors=0;
for(const file of walk('apps/web').filter(x=>/\.tsx?$/.test(x))) {
  const content=fs.readFileSync(file,'utf8');
  const source=ts.createSourceFile(file,content,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  for(const error of source.parseDiagnostics) {console.error(file,ts.flattenDiagnosticMessageText(error.messageText,'\n'));errors++;}
}
if(errors){console.error(`${errors} erro(s) de sintaxe.`);process.exit(1);}
console.log('OK: arquivos TS/TSX sem erros de sintaxe.');
