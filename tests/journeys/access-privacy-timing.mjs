import {execFileSync} from 'node:child_process'
import {startWorker} from '../support/worker.mjs'
import {accessPrivacyScenario} from '../scenarios/access-privacy.mjs'

// Bind the standalone clock receipt to the committed checkout, without a caller-supplied label.
process.env.PEGBOARD_PROOF_HEAD = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim()
const w = await startWorker()
try { await accessPrivacyScenario(w, {timing:true}) }
finally { await w.stop() }
