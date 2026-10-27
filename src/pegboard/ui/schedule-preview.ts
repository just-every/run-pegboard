import {PegError} from '../db'
import type {Actor} from '../workspace/people'
import {moveInput,planChange} from '../schedule/plan'
import type {SchedulePreview} from './schedule-editor'
export async function schedulePreview(db:D1Database,actor:Actor,input:Record<string,string>):Promise<SchedulePreview>{
 if(!input.taskId||!input.start&&!input.due)return null
 const move={taskId:input.taskId,...(input.start?{start:input.start}:{}),...(input.due?{due:input.due}:{})}
 try{const{all:_,...plan}=await planChange(db,actor,moveInput([move]));return {plan,move}}catch(error){if(error instanceof PegError)return {error:error.code};throw error}
}
