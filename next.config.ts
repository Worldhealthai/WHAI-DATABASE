import type { NextConfig } from 'next'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { remoteProblem, startupProblem } from './src/lib/dbEnv'

const nextConfig: NextConfig = {
  images: {
    // `images.domains` is deprecated in Next 16; this is the equivalent
    // remotePatterns entry (any protocol/port/path on localhost).
    remotePatterns: [{ hostname: 'localhost' }],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

// Refuse to build with database settings that could never work (for example
// CRM_DB_SCHEMA=crm without the Nexus project's service role key). On Vercel
// the failed build leaves the running deployment untouched, so a mistake in
// the switch-over never takes the CRM down. Unset CRM_DB_SCHEMA checks nothing.
//
// When building with CRM_DB_SCHEMA=crm, the Nexus project is also asked
// whether it takes the key and has the crm schema ready: a key from another
// project cannot always be told from the key itself. A build that cannot
// reach the project goes ahead, so a network problem never blocks a deployment.
export default async function config(phase: string): Promise<NextConfig> {
  const problem = startupProblem() ?? (phase === PHASE_PRODUCTION_BUILD ? await remoteProblem() : null)
  if (problem) throw new Error(`CRM database settings: ${problem}`)
  return nextConfig
}
