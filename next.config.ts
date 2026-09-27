import { createHash } from 'node:crypto'
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
//
// next build loads this file in its main process and again in each worker it
// starts, and the workers inherit the environment. So once the project has
// been asked and the build may go ahead, that is noted in the environment and
// the workers do not ask again: one request, and at most one warning, per
// build. The note is a fingerprint of the settings it was made for, so a note
// set by hand, or left over from other settings, never skips the question.
const CHECKED = 'CRM_DB_REMOTE_CHECKED'
const settingsPrint = () =>
  createHash('sha256')
    .update(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRM_DB_SCHEMA'].map((k) => process.env[k] ?? '').join('\n'))
    .digest('hex')

export default async function config(phase: string): Promise<NextConfig> {
  let problem = startupProblem()
  if (!problem && phase === PHASE_PRODUCTION_BUILD && process.env[CHECKED] !== settingsPrint()) {
    problem = await remoteProblem()
    if (!problem) process.env[CHECKED] = settingsPrint()
  }
  if (problem) throw new Error(`CRM database settings: ${problem}`)
  return nextConfig
}
