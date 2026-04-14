interface UsageBarProps {
  used: number
  limit: number
  label?: string
  showCount?: boolean
}

export default function UsageBar({ used, limit, label, showCount = true }: UsageBarProps) {
  const unlimited = limit >= 99999
  const pct = unlimited ? 0 : Math.min(100, (used / limit) * 100)
  const warn = pct >= 80 && pct < 95
  const crit = pct >= 95

  return (
    <div>
      {(label || showCount) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          {label && <span style={{ fontSize: 12, color: 'var(--ink-light)' }}>{label}</span>}
          {showCount && (
            <span style={{ fontSize: 12, color: crit ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--ink-light)' }}>
              {unlimited ? `${used} used` : `${used} / ${limit}`}
            </span>
          )}
        </div>
      )}
      {!unlimited && (
        <div className="usage-bar-track">
          <div
            className={`usage-bar-fill${warn ? ' warn' : crit ? ' crit' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
