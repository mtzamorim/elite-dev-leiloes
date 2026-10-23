/**
 * Faz download sequencial de miniaturas públicas verificadas para a demonstração.
 * Execute uma vez com acesso à internet e versione os dois JPEGs resultantes.
 * Em caso de falha, não substitui um arquivo já baixado.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const destination=path.join(root,'apps/web/public/artworks');
const artworks=[
  {
    id:27992,
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg'
  },
  {
    id:28560,
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Van_Gogh_-_The_Bedroom%2C_1889_Chicago.jpg/960px-Van_Gogh_-_The_Bedroom%2C_1889_Chicago.jpg'
  }
];

await mkdir(destination,{recursive:true});
let errors=0;
for (const {id,url} of artworks) {
  const filename=path.join(destination,`${id}.jpg`);
  try {
    const existing=await readFile(filename).catch(()=>null);
    if(existing?.length>30_000){console.info(`${id}: arquivo local já existe; mantido.`);continue;}
    const response=await fetch(url,{signal:AbortSignal.timeout(30_000),headers:{'User-Agent':'AtelierLeiloes/1.0 (educational demo; Wikimedia Commons thumbnail)'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    if(!response.headers.get('content-type')?.toLowerCase().startsWith('image/jpeg'))throw new Error('Servidor não retornou JPEG.');
    const image=Buffer.from(await response.arrayBuffer());
    if(image.length<30_000 || image.length>5_000_000 || image[0]!==0xff || image[1]!==0xd8)throw new Error('Imagem inválida ou tamanho inesperado.');
    const temp=`${filename}.tmp`;
    try{await writeFile(temp,image);await rename(temp,filename);}catch(error){await rm(temp,{force:true});throw error;}
    console.info(`${id}: ${Math.round(image.length/1024)} KB salvos em apps/web/public/artworks/${id}.jpg`);
  } catch(error){errors++;console.error(`${id}: falha ao salvar miniatura (${error.message}).`);}
}
if(errors) {
  console.error('Algumas miniaturas não foram baixadas. Verifique a rede; o frontend ainda tentará as fontes públicas alternativas.');
  process.exitCode=1;
} else console.info('Miniaturas locais prontas para versionamento e deploy.');
