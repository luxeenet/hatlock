// Phone Number Normalization and Matching Utilities
// Handles international formats (+255, 255), local formats (07...), and raw digits

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('255') && digits.length >= 12) {
    return digits.slice(3); // e.g. 712345678
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return digits.slice(1); // e.g. 712345678
  }
  return digits.slice(-9); // canonical 9 digits
}

export function phoneNumbersMatch(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizePhoneNumber(phoneA);
  const normB = normalizePhoneNumber(phoneB);
  return normA.length >= 7 && normA === normB;
}

