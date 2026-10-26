export interface TemplateField { key:string; label:string; type:'text'|'number'|'checkbox'|'single'; options?:string[] }
export interface TemplateTask { key:string; title:string; phase:string; role:string; start:number; due:number; hours:number; parent?:string; kind?:'task'|'subtask'|'milestone'; approval?:boolean; fields:Record<string,string|number|boolean> }
export interface TemplateEdge { predecessor:string; successor:string; type:'fs'|'ss'|'ff'|'sf'; lag:number }
export interface TemplateRule { key:string; name:string; trigger:'task_created'; action:'set_priority'; priority:'normal'|'high'|'urgent' }
export interface TemplateDefinition { kind:'task'|'project'; description:string; roles:string[]; phases:string[]; fields:TemplateField[]; tasks:TemplateTask[]; dependencies:TemplateEdge[]; rules:TemplateRule[] }
export interface TemplateRecord { id:string; workspace_id:string; name:string; family:string; authority_project:string|null; created_by:string; created_at:number }
export interface TemplateInput { templateId:string; version:number; startDate:string; name:string; roles:Record<string,string|null>; keepUnassigned?:boolean; targetProjectId?:string; token?:string }
