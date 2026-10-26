import type {TemplateDefinition} from '../../templates/types'
export function TemplateStructure({definition}:{definition:TemplateDefinition}){
 return <section aria-label="Reusable structure preview">
  <h3>Work to reuse</h3>
  <ul className="rows">{definition.tasks.map(task=><li key={task.key}><span className="grow"><strong>{task.title}</strong><br/>{task.parent?'Nested work · ':''}{task.phase} · {task.role} · start +{task.start}, due +{task.due} working days · {task.hours} hours{task.approval?' · New approval required':''}</span></li>)}</ul>
  <p>Fields: {definition.fields.map(f=>f.label).join(', ')||'None'}. {definition.dependencies.length} dependency edges and {definition.rules.length} inactive rules.</p>
  <details><summary>Configuration details</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(definition,null,2)}</pre></details>
 </section>
}
