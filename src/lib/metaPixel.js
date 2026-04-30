export const trackEvent = (eventName, params = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", eventName, params);
    console.log(`Meta Pixel Event Fired: ${eventName}`, params);
  }
};

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

export async function trackServerEvent(eventName, userEmail = null, userId = null) {
  try {
    const eventId = `${eventName}_${Date.now()}`
    const fbp = typeof document !== 'undefined' ? getCookie('_fbp') : null
    const fbc = typeof document !== 'undefined' ? getCookie('_fbc') : null
    await fetch(
      'https://fcawdtlcimytvohivhfq.supabase.co/functions/v1/meta-conversions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName, userEmail, userId, eventId, fbp, fbc }),
      }
    )
  } catch (err) {
    console.error('Meta CAPI error:', err)
  }
}
