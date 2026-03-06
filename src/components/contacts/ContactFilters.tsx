'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContactFilters, HierarchicalVertical, TaxonomyItem, SeniorityLevel, Department } from '@/types'
import {
  SENIORITY_LABELS, DEPARTMENT_LABELS,
} from '@/types'

interface TaxonomyData {
  verticals: HierarchicalVertical[]
  therapeuticAreas: TaxonomyItem[]
  jobFunctions: TaxonomyItem[]
  regions: Array<TaxonomyItem & { children: TaxonomyItem[] }>
}

interface ContactFiltersProps {
  filters: ContactFilters
  taxonomy: TaxonomyData | undefined
  onChange: (filters: ContactFilters) => void
}

function FilterSection({
  title, defaultOpen = true, children,
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="filter-section">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors mb-2"
      >
        {title}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

function MultiCheckbox<T extends string>({
  options, selected, onChange,
}: {
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (selected: T[]) => void
}) {
  const toggle = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value))
    } else {
      onChange([...selected, value])
    }
  }
  return (
    <>
      {options.map(({ value, label }) => (
        <label
          key={value}
          className="flex items-center gap-2 cursor-pointer py-0.5 group"
        >
          <input
            type="checkbox"
            checked={selected.includes(value)}
            onChange={() => toggle(value)}
            className="w-3.5 h-3.5 rounded border-slate-600 bg-transparent accent-[#00B4D8] cursor-pointer"
          />
          <span className={cn(
            'text-sm transition-colors',
            selected.includes(value) ? 'text-[#00B4D8]' : 'text-slate-300 group-hover:text-white',
          )}>
            {label}
          </span>
        </label>
      ))}
    </>
  )
}

export function ContactFilterSidebar({ filters, taxonomy, onChange }: ContactFiltersProps) {
  const update = (partial: Partial<ContactFilters>) => onChange({ ...filters, ...partial })

  return (
    <aside className="w-64 shrink-0 space-y-0 overflow-y-auto pr-2">
      {/* Keyword search */}
      <div className="filter-section">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={filters.query ?? ''}
            onChange={(e) => update({ query: e.target.value || undefined })}
            placeholder="Search name, title, company..."
            className="w-full pl-8 pr-3 py-2 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white placeholder-slate-500 outline-none focus:border-[#00B4D8] transition-colors"
          />
        </div>
      </div>

      {/* Seniority */}
      <FilterSection title="Seniority Level">
        <MultiCheckbox
          options={(Object.keys(SENIORITY_LABELS) as SeniorityLevel[]).map((k) => ({
            value: k,
            label: SENIORITY_LABELS[k],
          }))}
          selected={filters.seniority ?? []}
          onChange={(v) => update({ seniority: v.length ? v : undefined })}
        />
      </FilterSection>

      {/* Department */}
      <FilterSection title="Department" defaultOpen={false}>
        <MultiCheckbox
          options={(Object.keys(DEPARTMENT_LABELS) as Department[]).map((k) => ({
            value: k,
            label: DEPARTMENT_LABELS[k],
          }))}
          selected={filters.department ?? []}
          onChange={(v) => update({ department: v.length ? v : undefined })}
        />
      </FilterSection>

      {/* Job Function */}
      {taxonomy?.jobFunctions && (
        <FilterSection title="Job Function" defaultOpen={false}>
          <MultiCheckbox
            options={taxonomy.jobFunctions.map((jf) => ({ value: jf.id, label: jf.name }))}
            selected={filters.jobFunctionIds ?? []}
            onChange={(v) => update({ jobFunctionIds: v.length ? v : undefined })}
          />
        </FilterSection>
      )}

      {/* Healthcare Vertical */}
      {taxonomy?.verticals && (
        <FilterSection title="Healthcare Vertical" defaultOpen={false}>
          {taxonomy.verticals.map((parent) => (
            <div key={parent.id}>
              <div className="text-xs font-medium text-slate-500 mt-2 mb-1 uppercase tracking-wide">
                {parent.name}
              </div>
              {parent.children?.map((child) => (
                <label key={child.id} className="flex items-center gap-2 cursor-pointer py-0.5 pl-2 group">
                  <input
                    type="checkbox"
                    checked={(filters.verticalIds ?? []).includes(child.id)}
                    onChange={() => {
                      const current = filters.verticalIds ?? []
                      update({
                        verticalIds: current.includes(child.id)
                          ? current.filter((id) => id !== child.id)
                          : [...current, child.id],
                      })
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8] cursor-pointer"
                  />
                  <span className={cn(
                    'text-sm transition-colors',
                    (filters.verticalIds ?? []).includes(child.id)
                      ? 'text-[#00B4D8]'
                      : 'text-slate-300 group-hover:text-white',
                  )}>
                    {child.name}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </FilterSection>
      )}

      {/* Therapeutic Area */}
      {taxonomy?.therapeuticAreas && (
        <FilterSection title="Therapeutic Area" defaultOpen={false}>
          <MultiCheckbox
            options={taxonomy.therapeuticAreas.map((ta) => ({ value: ta.id, label: ta.name }))}
            selected={filters.therapeuticAreaIds ?? []}
            onChange={(v) => update({ therapeuticAreaIds: v.length ? v : undefined })}
          />
        </FilterSection>
      )}

      {/* Region / Country */}
      {taxonomy?.regions && (
        <FilterSection title="Region" defaultOpen={false}>
          {taxonomy.regions.map((region) => (
            <div key={region.id}>
              <div className="text-xs font-medium text-slate-500 mt-2 mb-1 uppercase tracking-wide">
                {region.name}
              </div>
              {region.children?.map((country) => (
                <label key={country.id} className="flex items-center gap-2 cursor-pointer py-0.5 pl-2 group">
                  <input
                    type="checkbox"
                    checked={(filters.regionIds ?? []).includes(country.id)}
                    onChange={() => {
                      const current = filters.regionIds ?? []
                      update({
                        regionIds: current.includes(country.id)
                          ? current.filter((id) => id !== country.id)
                          : [...current, country.id],
                      })
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-600 accent-[#00B4D8] cursor-pointer"
                  />
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                    {country.name}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </FilterSection>
      )}

      {/* Engagement Score */}
      <FilterSection title="Engagement Score" defaultOpen={false}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Min</label>
              <input
                type="number"
                min={0} max={100}
                value={filters.engagementMin ?? ''}
                onChange={(e) => update({ engagementMin: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white outline-none focus:border-[#00B4D8]"
                placeholder="0"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Max</label>
              <input
                type="number"
                min={0} max={100}
                value={filters.engagementMax ?? ''}
                onChange={(e) => update({ engagementMax: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-2 py-1.5 bg-[#112850] border border-[#1a3a5c] rounded text-sm text-white outline-none focus:border-[#00B4D8]"
                placeholder="100"
              />
            </div>
          </div>
        </div>
      </FilterSection>

      {/* Verified only */}
      <div className="filter-section">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => update({ isVerified: filters.isVerified === true ? undefined : true })}
            className={cn(
              'w-9 h-5 rounded-full relative transition-colors cursor-pointer',
              filters.isVerified ? 'bg-[#00B4D8]' : 'bg-[#1a3a5c]',
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              filters.isVerified ? 'translate-x-4' : 'translate-x-0.5',
            )} />
          </div>
          <span className="text-sm text-slate-300">Verified Only</span>
        </label>
      </div>
    </aside>
  )
}
