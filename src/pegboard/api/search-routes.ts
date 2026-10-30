import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door,json} from './door'
import {contentSearch} from '../search/content'
import {saveSearch,savedSearches,removeSearch} from '../search/saved'
export function searchRoutes(app:Hono<{Bindings:Bindings}>){
 app.get('/search',door(({db,actor,workspace,query})=>contentSearch(db,actor,workspace,Object.fromEntries(query))))
 app.get('/search/export',door(async({db,actor,workspace,query})=>{
  const result=await contentSearch(db,actor,workspace,Object.fromEntries(query))
  return json(result,200,{'content-disposition':'attachment; filename="search-results.json"'})
 }))
 app.get('/search/saved',door(async({db,actor,workspace})=>({searches:await savedSearches(db,actor,workspace)})))
 app.post('/search/saved',door(({db,actor,workspace,input})=>saveSearch(db,actor,workspace,input),{next:()=>'/app/search'}))
 app.post('/search/saved/:id/remove',door(({db,actor,workspace,params})=>removeSearch(db,actor,workspace,params.id),{next:()=>'/app/search'}))
}
