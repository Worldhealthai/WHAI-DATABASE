import type { NextConfig } from 'next'
import { startupProblem } from './src/lib/dbEnv'

// Refuse to build with database settings that could never work (for example
// CRM_DB_SCHEMA=crm without the Nexus project's service role key). On Vercel
// the failed build leaves the running deployment untouched, so a mistake in
// the switch-over never takes the CRM down. Unset CRM_DB_SCHEMA checks nothing.
const problem = startupProblem()
if (problem) throw new Error(`CRM database settings: ${problem}`)

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

export default nextConfig
