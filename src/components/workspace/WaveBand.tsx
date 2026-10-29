'use client'

// The deep-teal band the key numbers sit on (Overview, Pipeline), with a
// slow swell of waves along its foot. The waves are three copies of one
// path drifting at different speeds; reduced motion holds them still.

// One swell every 500 units, so sliding the 2000-wide strip by half loops.
const WAVE = `M0 60 ${[0, 500, 1000, 1500].map((x) => `C ${x + 150} 20 ${x + 350} 100 ${x + 500} 60`).join(' ')} V 120 H 0 Z`

export function WaveBand({ kicker, items, loading }: {
  kicker?: string
  items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[]
  loading?: boolean
}) {
  return (
    <div className="crm-wave">
      <svg viewBox="0 0 2000 120" preserveAspectRatio="none" aria-hidden="true">
        <path className="w1" d={WAVE} fill="#7fd3c4" />
        <path className="w2" d={WAVE} fill="#a6e3d8" transform="translate(0 14)" />
        <path className="w3" d={WAVE} fill="#ffffff" transform="translate(0 26)" />
      </svg>
      <div className="relative px-5 sm:px-6 pt-5 pb-9">
        {kicker && <p className="crm-wave-k mb-3">{kicker}</p>}
        <div className="grid grid-cols-2 xl:grid-flow-col xl:auto-cols-fr gap-x-6 gap-y-5">
          {items.map((t) => (
            <div key={t.label} className="min-w-0">
              <p className="text-[12.5px]" style={{ color: 'rgba(214, 240, 235, 0.78)' }}>{t.label}</p>
              {loading ? (
                <div className="h-8 w-14 rounded-md mt-2 animate-pulse" style={{ background: 'rgba(255,255,255,0.12)' }} />
              ) : (
                <p className="text-[30px] leading-none mt-2 tabular font-semibold" style={{ color: '#ffffff', letterSpacing: '-0.02em' }}>{t.value}</p>
              )}
              {t.hint && <p className="text-[12px] mt-2 truncate" style={{ color: 'rgba(214, 240, 235, 0.66)' }}>{t.hint}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
