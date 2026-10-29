'use client'

// The deep-teal band the key numbers sit on (Overview, Pipeline,
// Production, Registrations). Flat: no waves or glow, so nothing moves.

export function WaveBand({ kicker, items, loading }: {
  kicker?: string
  items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[]
  loading?: boolean
}) {
  return (
    <div className="crm-wave">
      <div className="relative px-5 sm:px-6 pt-5 pb-5">
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
