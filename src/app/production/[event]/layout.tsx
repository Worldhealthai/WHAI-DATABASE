'use client'

import { Suspense } from 'react'
import { WorkspaceProvider } from '@/lib/workspace'

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </Suspense>
  )
}
