import { useMemo } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Home,
  Info,
  Landmark,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { buildAlerts } from '../components/AlertsDropdown'
import usePortfolioData from '../hooks/usePortfolioData'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0))

const toMonthly = (amount, frequency) => {
  const map = {
    Weekly: 52 / 12,
    Fortnightly: 26 / 12,
    Monthly: 1,
    Quarterly: 1 / 3,
    Annual: 1 / 12,
  }

  return Number(amount || 0) * (map[frequency] || 1)
}

const getDaysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function Alerts() {
  const { properties, loans, transactions, loading } = usePortfolioData()

  const alerts = useMemo(() => buildAlerts(properties, loans), [properties, loans])

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const thisMonthTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const date = new Date(transaction.date)
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear
      }),
    [transactions, currentMonth, currentYear]
  )

  const portfolioMetrics = useMemo(() => {
    const totalValue = properties.reduce(
      (sum, property) => sum + Number(property.current_value || 0),
      0
    )

    const totalDebt = loans.reduce(
      (sum, loan) => sum + Number(loan.current_balance || 0),
      0
    )

    const totalMonthlyIncome = thisMonthTransactions
      .filter((transaction) => transaction.type === 'income')
      .reduce(
        (sum, transaction) => sum + toMonthly(transaction.amount, transaction.frequency),
        0
      )

    const totalMonthlyExpenses = thisMonthTransactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce(
        (sum, transaction) => sum + toMonthly(transaction.amount, transaction.frequency),
        0
      )

    return {
      totalValue,
      totalDebt,
      netMonthlyCashFlow: totalMonthlyIncome - totalMonthlyExpenses,
    }
  }, [properties, loans, thisMonthTransactions])

  const urgentAlerts = useMemo(
    () => alerts.filter((alert) => alert.urgent),
    [alerts]
  )

  const portfolioAlerts = useMemo(
    () => alerts.filter((alert) => !alert.urgent),
    [alerts]
  )

  const stableSignals = useMemo(() => {
    const fixedLoans = loans.filter((loan) => loan.loan_type === 'Fixed')
    const fixedStableCount = fixedLoans.filter((loan) => {
      const days = getDaysUntil(loan.fixed_rate_expiry)
      return days !== null && days > 90
    }).length

    const leaseTrackedCount = properties.filter(
      (property) => !!property.lease_expiry_date
    ).length
    const leaseStableCount = properties.filter((property) => {
      const days = getDaysUntil(property.lease_expiry_date)
      return days !== null && days > 90
    }).length

    const totalValue = portfolioMetrics.totalValue
    const portfolioLvr =
      totalValue > 0 ? (portfolioMetrics.totalDebt / totalValue) * 100 : 0

    const signals = []

    if (alerts.length === 0) {
      signals.push({
        id: 'signal-no-deadlines',
        title: 'No upcoming alert deadlines',
        description:
          'No fixed-rate, interest-only, or lease expiry events are due within the next 90 days.',
        icon: ShieldCheck,
        tone: 'positive',
      })
    }

    if (fixedStableCount > 0) {
      signals.push({
        id: 'signal-fixed-stable',
        title: 'Fixed-rate profile looks stable',
        description: `${fixedStableCount} fixed mortgage${
          fixedStableCount === 1 ? '' : 's'
        } expire beyond the next 90 days.`,
        icon: Landmark,
        tone: 'neutral',
      })
    }

    if (leaseStableCount > 0) {
      signals.push({
        id: 'signal-lease-stable',
        title: 'Lease expiries are not immediate',
        description: `${leaseStableCount} of ${leaseTrackedCount} tracked lease${
          leaseTrackedCount === 1 ? '' : 's'
        } expire beyond the next 90 days.`,
        icon: Home,
        tone: 'neutral',
      })
    }

    if (transactions.length > 0) {
      signals.push({
        id: 'signal-cashflow',
        title:
          portfolioMetrics.netMonthlyCashFlow >= 0
            ? 'Portfolio cash flow is positive this month'
            : 'Portfolio cash flow is negative this month',
        description: `Current month net position is ${formatCurrency(
          portfolioMetrics.netMonthlyCashFlow
        )}.`,
        icon:
          portfolioMetrics.netMonthlyCashFlow >= 0 ? TrendingUp : TrendingDown,
        tone: portfolioMetrics.netMonthlyCashFlow >= 0 ? 'positive' : 'warning',
      })
    }

    if (totalValue > 0) {
      signals.push({
        id: 'signal-lvr',
        title:
          portfolioLvr >= 80
            ? 'Portfolio leverage is elevated'
            : 'Portfolio leverage is within a moderate range',
        description: `Portfolio LVR is currently ${portfolioLvr.toFixed(1)}%.`,
        icon: Info,
        tone: portfolioLvr >= 80 ? 'warning' : 'neutral',
      })
    }

    return signals
  }, [alerts.length, loans, portfolioMetrics, properties, transactions.length])

  const nextAlert = alerts[0] || null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading alerts...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Alerts
                </h1>
                <p className="text-gray-500 mt-2 max-w-2xl">
                  One place to review urgent deadlines, portfolio event risk, and
                  quieter signals across lending and lease activity.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 self-start rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
                <Bell size={14} />
                {alerts.length === 0
                  ? 'No active alerts'
                  : `${alerts.length} active alert${alerts.length === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-6 md:p-8 bg-gray-50/70">
            <MetricCard
              label="Urgent"
              value={urgentAlerts.length}
              helper="Action required within 30 days"
              valueClassName={urgentAlerts.length > 0 ? 'text-red-500' : 'text-gray-900'}
            />
            <MetricCard
              label="Portfolio Alerts"
              value={portfolioAlerts.length}
              helper="Upcoming within the next 90 days"
              valueClassName={
                portfolioAlerts.length > 0 ? 'text-amber-700' : 'text-gray-900'
              }
            />
            <MetricCard
              label="Stable Signals"
              value={stableSignals.length}
              helper="Read-only portfolio context"
            />
            <MetricCard
              label="Next Deadline"
              value={
                nextAlert?.days >= 0 ? `${nextAlert.days}d` : 'None'
              }
              helper={nextAlert ? nextAlert.title : 'No upcoming deadlines'}
              valueClassName={nextAlert ? 'text-primary-600' : 'text-gray-900'}
            />
          </div>
        </section>

        {alerts.length === 0 ? (
          <section className="mt-6 bg-white rounded-2xl border border-gray-100 p-8 md:p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mx-auto">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mt-5">
              No active alerts right now
            </h2>
            <p className="text-sm md:text-base text-gray-500 mt-2 max-w-2xl mx-auto">
              Nothing is due inside the current 90-day alert window. Fixed-rate
              expiries, interest-only deadlines, and lease renewals will appear here
              automatically as dates get closer.
            </p>
          </section>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2 space-y-6">
            <AlertSection
              title="Urgent Alerts"
              description="Items that need attention within the next 30 days."
              icon={<AlertTriangle size={18} className="text-red-500" />}
              alerts={urgentAlerts}
              emptyTitle="No urgent alerts"
              emptyDescription="Nothing currently requires action in the next 30 days."
            />

            <AlertSection
              title="Portfolio Alerts"
              description="Upcoming portfolio events already inside the 90-day watch window."
              icon={<CalendarClock size={18} className="text-amber-600" />}
              alerts={portfolioAlerts}
              emptyTitle="No upcoming portfolio alerts"
              emptyDescription="There are no non-urgent lending or lease alerts waiting in the queue."
            />
          </div>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-primary-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Stable / Informational Signals
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Context that helps you understand the wider portfolio picture.
                </p>
              </div>
            </div>

            {stableSignals.length === 0 ? (
              <EmptyState
                title="No informational signals yet"
                description="Add more portfolio data to unlock broader alert context."
                compact
              />
            ) : (
              <div className="space-y-3">
                {stableSignals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function AlertSection({
  title,
  description,
  icon,
  alerts,
  emptyTitle,
  emptyDescription,
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} compact />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </section>
  )
}

function AlertCard({ alert }) {
  const config = getAlertTone(alert)
  const Icon = alert.icon || Clock3

  return (
    <div className={`rounded-2xl border p-4 md:p-5 ${config.container}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${config.iconWrap}`}>
          <Icon size={18} className={config.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-gray-900">{alert.title}</h3>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${config.badge}`}>
                  {config.label}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-2 break-words">
                {alert.description}
              </p>
            </div>

            {typeof alert.days === 'number' ? (
              <div className="shrink-0">
                <div className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${config.daysBadge}`}>
                  {alert.days} days remaining
                </div>
              </div>
            ) : null}
          </div>

          {alert.detail ? (
            <p className="text-sm text-gray-500 mt-3">{alert.detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SignalCard({ signal }) {
  const config =
    signal.tone === 'positive'
      ? {
          bg: 'bg-green-50',
          border: 'border-green-100',
          iconWrap: 'bg-white',
          icon: 'text-green-600',
        }
      : signal.tone === 'warning'
      ? {
          bg: 'bg-amber-50',
          border: 'border-amber-100',
          iconWrap: 'bg-white',
          icon: 'text-amber-600',
        }
      : {
          bg: 'bg-gray-50',
          border: 'border-gray-100',
          iconWrap: 'bg-white',
          icon: 'text-gray-500',
        }

  const Icon = signal.icon || Info

  return (
    <div className={`rounded-2xl border p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.iconWrap}`}>
          <Icon size={18} className={config.icon} />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{signal.title}</h3>
          <p className="text-sm text-gray-600 mt-1">{signal.description}</p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  valueClassName = 'text-gray-900',
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-xl md:text-2xl font-bold ${valueClassName}`}>{value}</p>
      <p className="text-sm text-gray-400 mt-2">{helper}</p>
    </div>
  )
}

function EmptyState({ title, description, compact = false }) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-gray-200 text-center ${
        compact ? 'p-6' : 'p-10'
      }`}
    >
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  )
}

function getAlertTone(alert) {
  if (alert.urgent) {
    return {
      container: 'border-red-200 bg-red-50',
      iconWrap: 'bg-white',
      icon: 'text-red-500',
      badge: 'bg-red-100 text-red-700',
      daysBadge: 'bg-white text-red-700',
      label: 'Urgent',
    }
  }

  if (typeof alert.days === 'number' && alert.days <= 60) {
    return {
      container: 'border-amber-200 bg-amber-50',
      iconWrap: 'bg-white',
      icon: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700',
      daysBadge: 'bg-white text-amber-700',
      label: 'Upcoming',
    }
  }

  return {
    container: 'border-gray-100 bg-gray-50',
    iconWrap: 'bg-white',
    icon: 'text-gray-600',
    badge: 'bg-gray-200 text-gray-700',
    daysBadge: 'bg-white text-gray-700',
    label: 'Watch',
  }
}
