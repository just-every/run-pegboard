import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {startWorker} from '../support/worker.mjs'
import {templateGalleryJourney} from './template-gallery.mjs'
import {projectDuplicateJourney} from './project-duplicate.mjs'
import {templateRuleJourney} from './template-rules.mjs'

const w=await startWorker(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
try{
 for(const width of [1440,390]){
  const size=String(width),context=await browser.newContext({viewport:{width,height:width===390?844:900}})
  await context.addCookies(w.owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
  const proof=async name=>{
   await page.evaluate(()=>document.fonts.ready)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} reflows at ${size}`)
   const failures=await page.locator('main button,main a,header a').evaluateAll(elements=>elements.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')&&!e.getAttribute('aria-describedby')).map(e=>e.outerHTML))
   assert.deepEqual(failures,[],`${name} icon controls have tooltips`)
   assert.deepEqual(errors,[],`${name} has no browser error`)
   if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`templates-${name}-${size}.jpg`),type:'jpeg',quality:75,fullPage:true})}
  }
  try{
   const shared=await templateGalleryJourney({w,page,proof,size,ok})
   await projectDuplicateJourney({w,page,proof,size,ok,...shared})
   await templateRuleJourney({w,page,proof,size,ok,...shared})
   console.log(`Reusable template journey at ${size}px passed`)
  }finally{await context.close()}
 }
}finally{await browser.close();await w.stop()}
