interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: React.ReactNode
  accent?: boolean
}

export default function StatCard({ label, value, sub, icon, accent }: StatCardProps) {
  return (
    <div className="stat-card" style={accent ? { borderColor: 'var(--teal)', borderWidth: 1.5 } : undefined}>
      {icon && (
        <div style={{ marginBottom: 10, color: 'var(--teal)', opacity: .8 }}>{icon}</div>
      )}
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
      {sub && <p className="stat-card-sub">{sub}</p>}
    </div>
  )
}
