/**
 * Service canonicalization utilities
 * Maps various service name formats to canonical names
 */

/**
 * Canonical service name map
 * Maps common variations to canonical names
 */
const CANONICAL_MAP = {
  // Tinder variations
  "tinder dating app": "Tinder",
  "tinder dating app: date & chat": "Tinder",
  "tinder dating": "Tinder",
  "tinder": "Tinder",
  
  // Apple services
  "apple": "Apple",
  "apple services": "Apple",
  "apple icloud": "iCloud",
  "apple music": "Apple Music",
  "apple tv": "Apple TV+",
  "apple tv plus": "Apple TV+",
  
  // Google services
  "google": "Google",
  "google play": "Google Play",
  "google one": "Google One",
  "youtube premium": "YouTube Premium",
  "youtube": "YouTube Premium",
  
  // Other common services
  "netflix": "Netflix",
  "spotify": "Spotify",
  "amazon prime": "Amazon Prime",
  "amazon": "Amazon",
  "adobe": "Adobe",
  "microsoft": "Microsoft",
  "microsoft 365": "Microsoft 365",
  "office 365": "Microsoft 365",
};

/**
 * Provider detection from sender email/domain
 */
const PROVIDER_MAP = {
  "apple.com": "apple",
  "email.apple.com": "apple",
  "google.com": "google",
  "googleplay-noreply@google.com": "google",
  "stripe.com": "stripe",
  "paypal.com": "paypal",
};

/**
 * Canonicalize a service name
 * @param {string} service - Raw service name
 * @returns {string} Canonical service name
 */
export function canonicalizeService(service) {
  if (!service) return null;
  
  const normalized = service.trim().toLowerCase();
  
  // Check exact match first
  if (CANONICAL_MAP[normalized]) {
    return CANONICAL_MAP[normalized];
  }
  
  // Check partial matches (e.g., "Tinder Dating App: Date & Chat" contains "tinder")
  for (const [key, canonical] of Object.entries(CANONICAL_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return canonical;
    }
  }
  
  // If no match, return title-cased version of input
  return service
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Detect provider from sender email/domain
 * @param {string} from - Sender email address
 * @returns {string|null} Provider name (apple, google, stripe, etc.) or null
 */
export function detectProvider(from) {
  if (!from) return null;
  
  const fromLower = from.toLowerCase();
  
  for (const [domain, provider] of Object.entries(PROVIDER_MAP)) {
    if (fromLower.includes(domain)) {
      return provider;
    }
  }
  
  return "direct"; // Default to direct if no known provider
}

