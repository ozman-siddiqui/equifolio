export const trackEvent = (eventName, params = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", eventName, params);
    console.log(`Meta Pixel Event Fired: ${eventName}`, params);
  }
};
