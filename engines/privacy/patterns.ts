export interface PrivacyPattern {
  key: string;
  label: string;
  regex: RegExp;
}

/**
 * SIMULADO: heurística por reglas. Punto de integración futuro de un
 * motor de NLP dedicado a detección de PII clínica. No garantiza
 * anonimización completa.
 */
export const PRIVACY_PATTERNS: PrivacyPattern[] = [
  { key: "email", label: "posible correo electrónico", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { key: "phone", label: "posible teléfono", regex: /\b(?:\+34[\s-]?)?[6789]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g },
  { key: "dni", label: "posible DNI", regex: /\b\d{8}[A-Za-z]\b/g },
  { key: "nie", label: "posible NIE", regex: /\b[XYZxyz]\d{7}[A-Za-z]\b/g },
  { key: "hc", label: "posible número de historia clínica", regex: /\bHC[-\s]?\d{4,}\b/gi },
  {
    key: "address",
    label: "posible dirección postal",
    regex: /\b(calle|c\/|avenida|avda\.?|plaza)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]{2,30}\d{1,4}\b/gi,
  },
  {
    key: "dob",
    label: "posible fecha de nacimiento completa",
    regex: /(fecha de nacimiento|nacid[oa] el|f\.\s?nac\.?)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi,
  },
  { key: "postal", label: "posible código postal", regex: /\b(?:CP|código postal)[:\s]*\d{5}\b/gi },
  {
    key: "name",
    label: "posible nombre propio",
    regex: /\b(?:[Ss]r\.?|[Ss]ra\.?|[Dd]\.|[Dd]ña\.?|[Pp]aciente:)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2}/g,
  },
];
