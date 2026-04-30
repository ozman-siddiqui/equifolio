export const trackEvent = (eventName, params = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", eventName, params);
    console.log(`Meta Pixel Event Fired: ${eventName}`, params);
  }
};

export async function trackServerEvent(eventName, userEmail = null, userId = null) {
  try {
    await fetch(
      'https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/meta-conversions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, userEmail, userId }),
      }
    )
  } catch (err) {
    console.error('Meta CAPI error:', err)
  }
}
