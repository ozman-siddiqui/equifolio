import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Brain,
  Building2,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  Database,
  LayoutGrid,
  Shield,
  SlidersHorizontal,
  Sparkles,
  User,
  LockKeyhole,
} from 'lucide-react'

import { supabase } from '../supabase'
import usePortfolioData from '../hooks/usePortfolioData'

const PLAN_LIMITS = { starter: 3, investor: 10, premium: Infinity }
const SETTINGS_STORAGE_KEY = 'equifolio.settings'

function getInitialSettings() {
  if (typeof window === 'undefined') {
    return defaultSettings()
  }

  try {
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) return defaultSettings()
    return { ...defaultSettings(), ...JSON.parse(stored) }
  } catch {
    return defaultSettings()
  }
}

function defaultSettings() {
  return {
    defaultMonthFilter: 'current',
    showAlertsOnDashboard: true,
    showAIPanels: true,
    compactLayoutMode: false,
    fixedRateReminderThreshold: 90,
    alertsReminderThreshold: 30,
    highlightUrgentAlerts: true,
    showInformationalAlerts: true,
  }
}

export default function Settings({ session = null, subscription = null }) {
  const navigate = useNavigate()
  const { properties, loans, transactions, loading } = usePortfolioData()

  const [settings, setSettings] = useState(getInitialSettings)
  const [saveState, setSaveState] = useState('idle')
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  })
  const [passwordState, setPasswordState] = useState({
    loading: false,
    error: '',
    success: '',
  })

  useEffect(() => {
    if (saveState !== 'saved') return undefined

    const timeoutId = window.setTimeout(() => setSaveState('idle'), 2500)
    return () => window.clearTimeout(timeoutId)
  }, [saveState])

  const monthOptions = useMemo(() => {
    const months = [
      ...new Set(
        transactions.map((transaction) => String(transaction.date || '').slice(0, 7)).filter(Boolean)
      ),
    ]

    return months.sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const stats = useMemo(
    () => ({
      properties: properties.length,
      loans: loans.length,
      transactions: transactions.length,
    }),
    [properties.length, loans.length, transactions.length]
  )

  const planId = String(subscription?.plan || subscription?.tier || 'starter').toLowerCase()
  const normalizedPlan = PLAN_LIMITS[planId] ? planId : 'starter'
  const planLimit = PLAN_LIMITS[normalizedPlan]
  const propertyUsageLabel =
    planLimit === Infinity ? `${stats.properties} / Unlimited` : `${stats.properties} / ${planLimit}`
  const usagePercent =
    planLimit === Infinity ? Math.min((stats.properties / Math.max(stats.properties, 1)) * 100, 100) : Math.min((stats.properties / Math.max(planLimit, 1)) * 100, 100)

  const subscriptionSummary = useMemo(() => {
    const status = subscription?.status || 'active'
    const billingStatus =
      subscription?.billing_status ||
      subscription?.collection_status ||
      subscription?.payment_status ||
      null

    return {
      planLabel: capitalize(normalizedPlan),
      statusLabel: capitalize(status),
      billingLabel: billingStatus ? capitalizeWords(String(billingStatus).replaceAll('_', ' ')) : 'Not provided',
      isUpgradeRecommended:
        normalizedPlan !== 'premium' &&
        planLimit !== Infinity &&
        stats.properties >= planLimit,
      ctaLabel: normalizedPlan === 'premium' ? 'Manage Plan' : 'Upgrade Plan',
    }
  }, [normalizedPlan, planLimit, stats.properties, subscription])

  const accountEmail = session?.user?.email || 'No email available'
  const currentMonthLabel =
    settings.defaultMonthFilter === 'current'
      ? 'Current month'
      : settings.defaultMonthFilter === 'all'
      ? 'All months'
      : settings.defaultMonthFilter

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    setSaveState('saved')
  }

  const handlePasswordChange = async (event) => {
    event.preventDefault()

    const nextPassword = passwordForm.password
    const confirmPassword = passwordForm.confirmPassword

    if (!session?.user) {
      setPasswordState({
        loading: false,
        error: 'No active session available for password updates.',
        success: '',
      })
      return
    }

    if (nextPassword.length < 8) {
      setPasswordState({
        loading: false,
        error: 'Use at least 8 characters for the new password.',
        success: '',
      })
      return
    }

    if (nextPassword !== confirmPassword) {
      setPasswordState({
        loading: false,
        error: 'Password confirmation does not match.',
        success: '',
      })
      return
    }

    setPasswordState({ loading: true, error: '', success: '' })

    const { error } = await supabase.auth.updateUser({ password: nextPassword })

    if (error) {
      setPasswordState({
        loading: false,
        error: error.message || 'Password update failed.',
        success: '',
      })
      return
    }

    setPasswordForm({ password: '', confirmPassword: '' })
    setPasswordState({
      loading: false,
      error: '',
      success: 'Password updated successfully.',
    })
    setShowPasswordForm(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full mb-4">
                  <SlidersHorizontal size={13} />
                  Workspace Control Centre
                </div>

                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Settings
                </h1>

                <p className="text-gray-500 mt-2 max-w-2xl">
                  Manage your account context, subscription visibility, workspace
                  defaults, and alert behaviour without leaving the portfolio shell.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {saveState === 'saved' ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                    <CheckCircle2 size={16} />
                    Preferences saved locally
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  <Sparkles size={16} />
                  Save Preferences
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-6 md:p-8 bg-gray-50/70">
            <TopStatCard
              label="Current Plan"
              value={subscriptionSummary.planLabel}
              helper={subscriptionSummary.statusLabel}
            />
            <TopStatCard
              label="Property Usage"
              value={propertyUsageLabel}
              helper={planLimit === Infinity ? 'No plan cap' : 'Tracked against plan limit'}
            />
            <TopStatCard
              label="Alert Threshold"
              value={`${settings.alertsReminderThreshold} days`}
              helper="Current alert reminder window"
            />
            <TopStatCard
              label="AI Panels"
              value={settings.showAIPanels ? 'Enabled' : 'Hidden'}
              helper="Workspace preference"
            />
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SettingsCard
            className="xl:col-span-1"
            icon={<User size={18} className="text-primary-600" />}
            title="Account"
            description="Signed-in account context for the current workspace."
          >
            <SummaryTile
              label="Signed-in email"
              value={accountEmail}
              description="This account is currently active in the Equifolio workspace."
            />

            <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
              <p className="text-xs uppercase tracking-wide text-gray-400">Account summary</p>
              <p className="text-sm font-semibold text-gray-900 mt-2">
                {session?.user ? 'Authenticated session active' : 'Session unavailable'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Use this account to manage subscription access, portfolio data, and saved local preferences.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-100 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <LockKeyhole size={16} className="text-primary-600" />
                    <p className="text-sm font-semibold text-gray-900">Account & Security</p>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Email is read-only here. Use a direct password update flow for account security.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm((prev) => !prev)
                    setPasswordState((prev) => ({ ...prev, error: '', success: '' }))
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
                >
                  Change Password
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-900 mt-2 break-words">
                  {accountEmail}
                </p>
              </div>

              {showPasswordForm ? (
                <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
                  <FieldRow label="New password">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.password}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="At least 8 characters"
                    />
                  </FieldRow>

                  <FieldRow label="Confirm new password">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Re-enter new password"
                    />
                  </FieldRow>

                  {passwordState.error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {passwordState.error}
                    </div>
                  ) : null}

                  {passwordState.success ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                      {passwordState.success}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={passwordState.loading}
                      className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                    >
                      {passwordState.loading ? 'Updating...' : 'Update Password'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false)
                        setPasswordForm({ password: '', confirmPassword: '' })
                        setPasswordState({ loading: false, error: '', success: '' })
                      }}
                      className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </SettingsCard>

          <SettingsCard
            className="xl:col-span-2"
            icon={<CreditCard size={18} className="text-primary-600" />}
            title="Subscription"
            description="Current plan visibility and usage against plan capacity."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SummaryTile
                label="Plan"
                value={subscriptionSummary.planLabel}
                description="Plan/tier currently attached to this signed-in account."
              />
              <SummaryTile
                label="Subscription status"
                value={subscriptionSummary.statusLabel}
                description="Status sourced from the subscription record already loaded by the app."
                valueClassName={getStatusTone(subscription?.status || 'active')}
              />
              <SummaryTile
                label="Billing status"
                value={subscriptionSummary.billingLabel}
                description="Displayed when available on the existing subscription object."
              />
              <SummaryTile
                label="Property usage"
                value={propertyUsageLabel}
                description={
                  planLimit === Infinity
                    ? 'Premium plan has no property cap.'
                    : `${Math.max(planLimit - stats.properties, 0)} slot${
                        Math.max(planLimit - stats.properties, 0) === 1 ? '' : 's'
                      } remaining before the current limit is reached.`
                }
              />
            </div>

            <div className="rounded-2xl border border-gray-100 p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    Plan capacity
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {planLimit === Infinity
                      ? 'You are on the highest tier with unlimited property capacity.'
                      : `You are currently using ${stats.properties} of ${planLimit} available property slots.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    subscriptionSummary.isUpgradeRecommended
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {subscriptionSummary.ctaLabel}
                </button>
              </div>

              <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    usagePercent >= 100 ? 'bg-red-500' : usagePercent >= 80 ? 'bg-amber-500' : 'bg-primary-600'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SettingsCard
            icon={<LayoutGrid size={18} className="text-primary-600" />}
            title="Workspace Preferences"
            description="UI defaults that shape the product experience across portfolio pages."
          >
            <FieldRow label="Default cash flow month filter">
              <select
                value={settings.defaultMonthFilter}
                onChange={(e) => handleSettingChange('defaultMonthFilter', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="current">Current month</option>
                <option value="all">All months</option>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </FieldRow>

            <ToggleRow
              label="Show alerts on dashboard"
              description="Surface alert snapshot cards and urgent alert callouts on the dashboard."
              checked={settings.showAlertsOnDashboard}
              onChange={() =>
                handleSettingChange('showAlertsOnDashboard', !settings.showAlertsOnDashboard)
              }
            />

            <ToggleRow
              label="Show AI insights panels"
              description="Keep AI insight and score panels visible across supported screens."
              checked={settings.showAIPanels}
              onChange={() => handleSettingChange('showAIPanels', !settings.showAIPanels)}
            />

            <ToggleRow
              label="Compact layout mode"
              description="Reduce visual spacing and keep more portfolio data visible per viewport."
              checked={settings.compactLayoutMode}
              onChange={() =>
                handleSettingChange('compactLayoutMode', !settings.compactLayoutMode)
              }
            />

            <FieldRow label="Fixed-rate reminder threshold">
              <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {settings.fixedRateReminderThreshold} days
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Default watch window for fixed-rate reminders.
                    </p>
                  </div>
                  <CalendarRange size={18} className="text-primary-600" />
                </div>
                <input
                  type="range"
                  min="15"
                  max="180"
                  step="15"
                  value={settings.fixedRateReminderThreshold}
                  onChange={(e) =>
                    handleSettingChange('fixedRateReminderThreshold', Number(e.target.value))
                  }
                  className="w-full mt-4"
                />
              </div>
            </FieldRow>
          </SettingsCard>

          <SettingsCard
            icon={<Bell size={18} className="text-primary-600" />}
            title="Alerts Preferences"
            description="Controls that shape how aggressively Equifolio highlights alert activity."
          >
            <FieldRow label="Reminder threshold in days">
              <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {settings.alertsReminderThreshold} days
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Days before an event should begin showing as an alert preference.
                    </p>
                  </div>
                  <Bell size={18} className="text-primary-600" />
                </div>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="5"
                  value={settings.alertsReminderThreshold}
                  onChange={(e) =>
                    handleSettingChange('alertsReminderThreshold', Number(e.target.value))
                  }
                  className="w-full mt-4"
                />
              </div>
            </FieldRow>

            <ToggleRow
              label="Highlight urgent alerts"
              description="Keep urgent items visually elevated with stronger emphasis."
              checked={settings.highlightUrgentAlerts}
              onChange={() =>
                handleSettingChange('highlightUrgentAlerts', !settings.highlightUrgentAlerts)
              }
            />

            <ToggleRow
              label="Show informational alerts"
              description="Include softer portfolio signals alongside urgent deadlines."
              checked={settings.showInformationalAlerts}
              onChange={() =>
                handleSettingChange(
                  'showInformationalAlerts',
                  !settings.showInformationalAlerts
                )
              }
            />
          </SettingsCard>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SettingsCard
            className="xl:col-span-2"
            icon={<Database size={18} className="text-primary-600" />}
            title="Data / Product Info"
            description="Current portfolio data footprint and clean app-state visibility."
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DataCountCard
                icon={<Building2 size={16} className="text-primary-600" />}
                label="Properties"
                value={stats.properties}
              />
              <DataCountCard
                icon={<CreditCard size={16} className="text-orange-600" />}
                label="Loans"
                value={stats.loans}
              />
              <DataCountCard
                icon={<Brain size={16} className="text-green-600" />}
                label="Transactions"
                value={stats.transactions}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <AppStateCard
                title="Workspace state"
                rows={[
                  { label: 'Cash flow default', value: currentMonthLabel },
                  { label: 'Dashboard alerts', value: yesNo(settings.showAlertsOnDashboard) },
                  { label: 'AI panels', value: yesNo(settings.showAIPanels) },
                  { label: 'Compact layout', value: yesNo(settings.compactLayoutMode) },
                ]}
              />

              <AppStateCard
                title="Alert state"
                rows={[
                  { label: 'Reminder threshold', value: `${settings.alertsReminderThreshold} days` },
                  { label: 'Urgent highlight', value: yesNo(settings.highlightUrgentAlerts) },
                  { label: 'Informational alerts', value: yesNo(settings.showInformationalAlerts) },
                  { label: 'Fixed-rate window', value: `${settings.fixedRateReminderThreshold} days` },
                ]}
              />
            </div>
          </SettingsCard>

          <SettingsCard
            className="xl:col-span-1"
            icon={<Shield size={18} className="text-primary-600" />}
            title="Product Summary"
            description="A quick read of the current account and portfolio posture."
          >
            <div className="space-y-3">
              <InsightRow
                tone="neutral"
                title="Subscription context"
                description={`${subscriptionSummary.planLabel} plan with ${subscriptionSummary.statusLabel.toLowerCase()} subscription state.`}
              />
              <InsightRow
                tone={stats.properties > 0 ? 'positive' : 'neutral'}
                title="Portfolio footprint"
                description={
                  stats.properties > 0
                    ? `${stats.properties} propert${stats.properties === 1 ? 'y' : 'ies'} and ${stats.loans} linked loan${stats.loans === 1 ? '' : 's'} are currently loaded.`
                    : 'No properties are currently loaded in the workspace.'
                }
              />
              <InsightRow
                tone={settings.showAIPanels ? 'positive' : 'neutral'}
                title="Experience mode"
                description={
                  settings.compactLayoutMode
                    ? 'Compact layout preference is enabled for denser portfolio views.'
                    : 'Standard layout density is enabled for a more spacious reading experience.'
                }
              />
            </div>
          </SettingsCard>
        </div>
      </main>
    </div>
  )
}

function SettingsCard({ icon, title, description, children, className = '' }) {
  return (
    <section className={`bg-white rounded-2xl border border-gray-100 overflow-hidden ${className}`}>
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </section>
  )
}

function TopStatCard({ label, value, helper }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2 break-words">
        {value}
      </p>
      <p className="text-sm text-gray-400 mt-2">{helper}</p>
    </div>
  )
}

function SummaryTile({ label, value, description, valueClassName = 'text-gray-900' }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-sm font-semibold mt-2 break-words ${valueClassName}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
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

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full flex items-center justify-between gap-4 rounded-2xl border border-gray-100 px-4 py-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      <span
        className={`inline-flex h-6 w-11 rounded-full transition-colors shrink-0 ${
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

function DataCountCard({ icon, label, value }) {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3">{value}</p>
    </div>
  )
}

function AppStateCard({ title, rows }) {
  return (
    <div className="rounded-2xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-3 mt-4">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">{row.label}</span>
            <span className="font-medium text-gray-900 text-right">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function InsightRow({ title, description, tone = 'neutral' }) {
  const toneClass =
    tone === 'positive'
      ? 'bg-green-50 border-green-100'
      : tone === 'warning'
      ? 'bg-amber-50 border-amber-100'
      : 'bg-gray-50 border-gray-100'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  )
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1)
}

function capitalizeWords(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map(capitalize)
    .join(' ')
}

function yesNo(value) {
  return value ? 'Enabled' : 'Disabled'
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'active' || normalized === 'trialing') return 'text-green-600'
  if (normalized === 'past_due' || normalized === 'incomplete') return 'text-amber-600'
  return 'text-gray-900'
}
