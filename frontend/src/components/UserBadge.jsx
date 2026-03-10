import React from 'react'
import { Crown, Gem, BadgeCheck } from 'lucide-react'

export default function UserBadge({ tier, compact = false }) {
  const normalized = tier || 'free'

  if (normalized === 'owner') {
    return (
      <span className={`badge-owner ${compact ? 'badge-compact' : ''}`}>
        <span className="badge-owner-particles" aria-hidden="true" />
        <Crown size={12} />
        <span>Legendary Owner</span>
      </span>
    )
  }

  if (normalized === 'premium') {
    return (
      <span className={`badge-premium ${compact ? 'badge-compact' : ''}`}>
        <Gem size={12} />
        <span>Premium</span>
      </span>
    )
  }

  return (
    <span className={`badge-free ${compact ? 'badge-compact' : ''}`}>
      <BadgeCheck size={12} />
      <span>Free</span>
    </span>
  )
}
