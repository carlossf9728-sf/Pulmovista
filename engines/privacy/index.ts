/**
 * PrivacyEngine
 * ----------------------------------------------------------------------
 * INPUT CLÍNICO → PRIVACY SHIELD → TEXTO PSEUDONIMIZADO → ExtractionEngine
 *
 * Herramienta EXPERIMENTAL basada en reglas locales (ver patterns.ts). No
 * garantiza anonimización completa: siempre debe revisarse manualmente.
 */
import { PRIVACY_PATTERNS } from "./patterns";
import type { PrivacyFinding } from "@/types/privacy";

export function scanPrivacyShield(text: string | null | undefined): PrivacyFinding[] {
  if (!text) return [];
  const findings: PrivacyFinding[] = [];
  PRIVACY_PATTERNS.forEach((p) => {
    const matches = [...text.matchAll(p.regex)].map((m) => m[0]);
    if (matches.length) findings.push({ key: p.key, label: p.label, matches: [...new Set(matches)] });
  });
  return findings;
}

export function redactText(text: string, findings: PrivacyFinding[]): string {
  let out = text;
  findings.forEach((f) => f.matches.forEach((m) => { out = out.split(m).join("[DATO ELIMINADO]"); }));
  return out;
}
