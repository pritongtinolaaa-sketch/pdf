import React from 'react'
import * as Icons from 'lucide-react'
import { categories } from '../tools.js'

const categoryAccent = {
  edit:           { from: '#34d399', to: '#10b981' },
  improve:        { from: '#60a5fa', to: '#3b82f6' },
  'convert-from': { from: '#f472b6', to: '#ec4899' },
  'convert-to':   { from: '#fb923c', to: '#f97316' },
}

function ToolCard({ tool, onSelect, accent }) {
  const Icon = Icons[tool.icon] ?? Icons.FileText
  const { from, to } = accent

  return (
    <button
      onClick={() => onSelect(tool)}
      className="card flex flex-col gap-4 text-left group w-full"
    >
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
        style={{
          background: `linear-gradient(135deg, ${from}18 0%, ${to}10 100%)`,
          border: `1px solid ${from}30`,
          boxShadow: `0 0 12px ${from}15`,
        }}
      >
        <Icon size={18} style={{ color: from }} />
      </div>

      {/* Text */}
      <div>
        <p className="font-semibold text-white text-sm leading-tight">
          {tool.label}
        </p>
        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed line-clamp-2">
          {tool.description}
        </p>
      </div>

      {/* Hover shimmer line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${from}, transparent)` }}
      />
    </button>
  )
}

export default function ToolGrid({ onToolSelect }) {
  return (
    <section id="tools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28">

      {/* Section header */}
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">All Tools</h2>
        <p className="text-slate-500 text-sm">Pick a tool below and process files with your account credits.</p>
      </div>

      <div className="space-y-14">
        {categories.map((cat) => {
          const accent = categoryAccent[cat.id] ?? categoryAccent.edit
          return (
            <div key={cat.id}>
              {/* Category label */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-1 h-4 rounded-full"
                  style={{ background: `linear-gradient(180deg, ${accent.from}, ${accent.to})` }}
                />
                <h3
                  className="text-sm font-semibold tracking-widest uppercase"
                  style={{ color: accent.from }}
                >
                  {cat.label}
                </h3>
                <div
                  className="flex-1 h-px"
                  style={{ background: `linear-gradient(90deg, ${accent.from}30, transparent)` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {cat.tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} onSelect={onToolSelect} accent={accent} />
              ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
