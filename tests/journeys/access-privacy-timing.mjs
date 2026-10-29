import {startWorker} from '../support/worker.mjs'
import {accessPrivacyScenario} from '../scenarios/access-privacy.mjs'

const w = await startWorker()
try { await accessPrivacyScenario(w, {timing:true}) }
finally { await w.stop() }
