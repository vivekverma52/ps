type Status = 'UPLOADED' | 'RENDERED' | 'SENT' | 'ACTIVE' | 'SUSPENDED' | 'TRIAL'
type Plan   = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE' | 'ENT'

const STATUS_CLASS: Record<string, string> = {
  UPLOADED:  'badge badge-uploaded',
  RENDERED:  'badge badge-rendered',
  SENT:      'badge badge-sent',
  ACTIVE:    'badge badge-active',
  SUSPENDED: 'badge badge-suspended',
  TRIAL:     'badge badge-trial',
}

const PLAN_CLASS: Record<string, string> = {
  FREE:       'badge badge-free',
  PRO:        'badge badge-pro',
  GROWTH:     'badge badge-growth',
  ENTERPRISE: 'badge badge-enterprise',
  ENT:        'badge badge-enterprise',
}

const DOT: Record<string, string> = {
  UPLOADED: '○', RENDERED: '◉', SENT: '✓', ACTIVE: '●', SUSPENDED: '✕', TRIAL: '◌',
}

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_CLASS[status] ?? 'badge badge-uploaded'
  return <span className={cls}>{DOT[status] ?? '·'} {status}</span>
}

export function PlanBadge({ plan }: { plan: string }) {
  const upper = plan?.toUpperCase()
  const cls = PLAN_CLASS[upper] ?? 'badge badge-free'
  const label = upper === 'ENT' ? 'ENTERPRISE' : upper
  return <span className={cls}>{label}</span>
}
