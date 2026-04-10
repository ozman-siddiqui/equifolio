// Shared date utility functions for Vaulta.
// Used by: AlertsDropdown, Dashboard (Epic 7.2 Fixed Rate Expiry Campaign)

export function getDaysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
