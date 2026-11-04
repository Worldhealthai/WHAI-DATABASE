'use client'

// Where Back on a profile goes (November 2026): to the page the profile was
// opened from (a board, a list, Companies…), exactly as it was, skipping the
// profiles walked through with Previous/Next on the way. Counted per page
// load: a profile opened from a link or after a reload has no such page, and
// its Back goes to its event's board instead.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const PROFILE = /^\/((sponsors|partners|speakers|delegates)\/[^/]+|event\/[^/]+\/(companies|contacts)\/[^/]+)\/?$/

let sawPage = false   // a page that is not a profile, this load
let run = 0           // profiles in a row since it

// How many steps back to that page, or 0 when there is none.
export const stepsBack = () => (sawPage ? run : 0)

export function NavMemory() {
  const pathname = usePathname()
  useEffect(() => {
    if (PROFILE.test(pathname)) run++
    else { sawPage = true; run = 0 }
  }, [pathname])
  return null
}
