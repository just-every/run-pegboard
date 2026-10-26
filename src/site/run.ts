import type { RunData } from '../base/run-site'
import { runPricing } from '../base/run-pricing'

const run: RunData = {
  "name": "Pegboard",
  "repository": "https://github.com/just-every/run-pegboard",
  "clone": "npx -y @runeditrun/rer dev just-every/run-pegboard",
  "licence": "MIT",
  "docs": true,
  paths: { product: null },
  pricing: runPricing,
}

export default run
