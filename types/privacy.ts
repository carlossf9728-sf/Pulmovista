/**
 * PrivacyEngine — herramienta experimental basada en reglas locales.
 * No garantiza anonimización completa; ver engines/privacy/patterns.ts.
 */
export interface PrivacyFinding {
  key: string;
  label: string;
  matches: string[];
}
