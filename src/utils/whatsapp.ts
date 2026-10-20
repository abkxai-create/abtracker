/**
 * WhatsApp Action utilities
 * Explicitly creates https://wa.me links without triggering voice tel: dialer
 */

export function sanitizePhoneNumberForWhatsApp(phone: string): string {
  if (!phone) return '';
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // If number starts with 00, replace with nothing
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  // If starts with single 0 (e.g. 052-1234567, common UAE format 971 or UK 44),
  // default to adding country code if 10 digits starting with 05 (e.g. 9715... for UAE scaffold rentals)
  // or allow direct wa.me/digits
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '971' + digits.substring(1);
  }

  return digits;
}

export function getWhatsAppUrl(phone: string, text?: string): string {
  const sanitized = sanitizePhoneNumberForWhatsApp(phone);
  if (!sanitized) return '#';
  const baseUrl = `https://wa.me/${sanitized}`;
  if (text) {
    return `${baseUrl}?text=${encodeURIComponent(text)}`;
  }
  return baseUrl;
}
