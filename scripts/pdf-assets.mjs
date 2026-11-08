import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
// Ship the pinned PDF renderer as same-origin assets; source PDFs never leave the installation.
export function proofPdfAssets(){
 const assets=new Map(['pdf.mjs','pdf.worker.mjs'].map(name=>['/proof/'+name,readFileSync(require.resolve(['pdfjs-dist','build',name].join('/')))]))
 return {name:'pegboard-proof-pdf',
  configureServer(server){server.middlewares.use((request,response,next)=>{const bytes=assets.get(request.url?.split('?')[0]);if(!bytes)return next();response.setHeader('Content-Type','text/javascript; charset=utf-8');response.end(bytes)})},
  generateBundle(){if(this.environment.name==='client')for(const [path,source]of assets)this.emitFile({type:'asset',fileName:path.slice(1),source})},
 }
}
