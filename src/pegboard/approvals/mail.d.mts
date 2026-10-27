import type {Bindings} from '../../auth.server'
import type {operatorMail} from '../../mail.server.mjs'
export function approvalMail(env:Bindings):ReturnType<typeof operatorMail>
