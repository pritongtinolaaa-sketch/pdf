import React from 'react'
import { ArrowRight, ShieldCheck, Zap, Lock } from 'lucide-react'

const stats = [
  { icon: Zap, label: 'Lightning fast' },
  { icon: ShieldCheck, label: 'No data stored' },
  { icon: Lock, label: 'Fully private' },
]

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-24 sm:pt-24 sm:pb-32 text-center">

      {/* Dot grid background */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.07) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-[20%] left-[10%] w-72 h-72 rounded-full blur-3xl animate-pulse-slow"
          style={{ background: 'rgba(16,185,129,0.05)' }}
        />
        <div
          className="absolute top-[10%] right-[8%] w-56 h-56 rounded-full blur-3xl animate-pulse-slow"
          style={{ background: 'rgba(52,211,153,0.04)', animationDelay: '2s' }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 pill mb-8 text-[13px]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Free signup &middot; 30 starter credits &middot; Your files never leave your device
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6">
          <span className="text-white">Every PDF tool</span>
          <br />
          <span className="shimmer-text">you'll ever need.</span>
        </h1>

        {/* Sub-copy */}
        <p className="text-slate-400 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
          Merge, split, rotate, protect, unlock and convert PDFs right in your browser —
          instant, private, and completely free.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#tools" className="btn-primary text-base px-8 py-3.5 gap-2">
            Browse all tools
            <ArrowRight size={17} strokeWidth={2.5} />
          </a>
          <a href="#tools" className="btn-ghost text-base px-8 py-3.5">
            See what's free
          </a>
        </div>

        {/* Stat pills */}
        <div className="flex items-center justify-center flex-wrap gap-3">
          {stats.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-slate-400"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Icon size={14} className="text-green-400" />
              {label}
            </div>
          ))}
        </div>
      </div>

    </section>
  )
}
