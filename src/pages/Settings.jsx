import { useMemo, useState } from 'react'
import { Bell, Palette, Shield, User, Save } from 'lucide-react'
import usePortfolioData from '../hooks/usePortfolioData'

export default function Settings() {
  const { properties, loans, transactions } = usePortfolioData()

  const [settings, setSettings] = useState({
    defaultMonthFilter: 'current',
    showAIPanels: true,
    showAlerts: true,
    compactCards: false,
    reminderFixedExpiryDays: 90,
  })

  const stats = useMemo(() => {
    return {
      properties: properties.length,
      loans: loans.length,
      transactions: transactions.length,
    }
  }, [properties, loans, transactions])

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-500 mt-2">
              Configure the way Equifolio behaves across dashboard, alerts, and AI layers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50/70">
            <StatCard label="Properties" value={stats.properties} />
            <StatCard label="Loans" value={stats.loans} />
            <StatCard label="Transactions" value={stats.transactions} />
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SettingsCard
            icon={<User size={18} className="text-primary-600" />}
            title="Workspace Defaults"
            description="Defaults used when opening key pages."
          >
            <FieldRow label="Default cash flow month">
              <select
                value={settings.defaultMonthFilter}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, defaultMonthFilter: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
              >
                <option value="current">Current month</option>
                <option value="all">All months</option>
              </select>
            </FieldRow>

            <ToggleRow
              label="Compact cards"
              checked={settings.compactCards}
              onChange={() =>
                setSettings((prev) => ({ ...prev, compactCards: !prev.compactCards }))
              }
            />
          </SettingsCard>

          <SettingsCard
            icon={<Bell size={18} className="text-primary-600" />}
            title="Alerts"
            description="Control which proactive alerts are surfaced."
          >
            <ToggleRow
              label="Show alerts across dashboard"
              checked={settings.showAlerts}
              onChange={() =>
                setSettings((prev) => ({ ...prev, showAlerts: !prev.showAlerts }))
              }
            />

            <FieldRow label="Fixed-rate reminder threshold">
              <input
                type="number"
                min="15"
                max="180"
                value={settings.reminderFixedExpiryDays}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    reminderFixedExpiryDays: Number(e.target.value || 90),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
              />
            </FieldRow>
          </SettingsCard>

          <SettingsCard
            icon={<Palette size={18} className="text-primary-600" />}
            title="AI + Insights"
            description="Control whether AI layers are shown in the product."
          >
            <ToggleRow
              label="Show AI panels"
              checked={settings.showAIPanels}
              onChange={() =>
                setSettings((prev) => ({ ...prev, showAIPanels: !prev.showAIPanels }))
              }
            />
          </SettingsCard>

          <SettingsCard
            icon={<Shield size={18} className="text-primary-600" />}
            title="Data Integrity"
            description="Guardrails to keep the workspace clean and trustworthy."
          >
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-600">
              ID-safe joins and refresh-first fetch patterns should remain enabled to avoid duplicate
              property, loan, or transaction rendering.
            </div>
          </SettingsCard>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Save size={16} />
            Save Settings
          </button>
        </div>
      </main>
    </div>
  )
}

function SettingsCard({ icon, title, description, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:bg-gray-50"
    >
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span
        className={`inline-flex h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`h-6 w-6 rounded-full bg-white shadow transform transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  )
}