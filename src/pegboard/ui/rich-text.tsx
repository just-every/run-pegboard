import type { ReactNode } from 'react'
/** A deliberately small native Markdown surface. React escapes every text node; no HTML or remote preview is loaded. */
function inline(text:string):ReactNode[] {
 const out:ReactNode[]=[],pattern=/(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\))/g
 let at=0,match:RegExpExecArray|null
 while((match=pattern.exec(text))){
  out.push(text.slice(at,match.index))
  if(match[2])out.push(<strong key={match.index}>{match[2]}</strong>)
  else if(match[3])out.push(<em key={match.index}>{match[3]}</em>)
  else if(match[4])out.push(<code key={match.index}>{match[4]}</code>)
  else {
   let href:string|null=null
   try{const u=new URL(match[6]);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)href=u.href}catch{}
   out.push(href?<a key={match.index} href={href} rel="noreferrer noopener">{match[5]}</a>:match[0])
  }
  at=pattern.lastIndex
 }
 out.push(text.slice(at));return out
}
export function RichText({text}:{text:string}) {
 const lines=text.split('\n'),blocks:ReactNode[]=[]
 for(let i=0;i<lines.length;i++){
  const line=lines[i]
  if(/^[-*] /.test(line)){
   const items=[]
   do{items.push(<li key={i}>{inline(lines[i].slice(2))}</li>);i++}while(i<lines.length&&/^[-*] /.test(lines[i]))
   i--;blocks.push(<ul key={i}>{items}</ul>)
  }else if(/^#{1,3} /.test(line))blocks.push(<h3 key={i}>{inline(line.replace(/^#{1,3} /,''))}</h3>)
  else if(line)blocks.push(<p key={i}>{inline(line)}</p>)
 }
 return <div className="rich-text task-description">{blocks}</div>
}
export const TextHelp=()=> <p className="muted">Format with **bold**, *italic*, `code`, a list starting with - or [link text](https://example.test).</p>
export function LiveCollaboration({source,scope,version}:{source:string;scope:string;version:number}) {
 return <><div data-live-collaboration={source} data-live-scope={scope}><p data-live-region="source-revision">Source revision {version}</p><p aria-live="polite" data-live-status>Connecting to current revisions…</p><p role="alert" data-live-error hidden/><div data-live-conflict hidden><p>Newer text is available. Your draft is still here. Copy it or review the latest text before saving against the new revision.</p></div><div data-live-latest hidden/></div><script src="/look/collaboration.js" defer/></>
}
