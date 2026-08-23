export type DiagnosisCategory = "Bronquiectasias" | "EPOC" | "Fibrosis pulmonar" | "General";

/** Clasifica un diagnóstico libre en una categoría reconocida por los motores dependientes del diagnóstico. */
export function classifyDiagnosis(dx = ""): DiagnosisCategory {
  const d = dx.toLowerCase();
  if (/bronquiect/.test(d)) return "Bronquiectasias";
  if (/epoc/.test(d)) return "EPOC";
  if (/fibrosis|epid|intersticial/.test(d)) return "Fibrosis pulmonar";
  return "General";
}

/**
 * Categorías de los problemas clínicos ACTIVOS de un paciente — derivadas
 * del diagnóstico principal Y de los secundarios, no solo del principal.
 *
 * Un paciente puede tener varios problemas simultáneos (p. ej. fibrosis
 * pulmonar idiopática + bronquiectasias + infección crónica por
 * Pseudomonas); asumir "un único primaryDiagnosis decide todo" deja sin
 * cobertura a un problema real que solo conste como secundario. Esta
 * función es el primer paso hacia "problemas clínicos activos → módulos
 * de guías aplicables": hoy sigue clasificando por texto libre (no hay
 * todavía una lista estructurada de problemas), pero cualquier motor que
 * decida qué guía aplica debería consultar esta lista en vez de leer
 * `patient.primaryDiagnosis` directamente, para no quedar atado a un
 * único diagnóstico cuando el modelo de datos evolucione.
 */
export function activeProblemCategories(patient: { primaryDiagnosis: string; secondaryDiagnoses: string }): DiagnosisCategory[] {
  const categories = new Set<DiagnosisCategory>();
  categories.add(classifyDiagnosis(patient.primaryDiagnosis));
  for (const fragment of patient.secondaryDiagnoses.split(/[,;]/)) {
    if (fragment.trim()) categories.add(classifyDiagnosis(fragment));
  }
  categories.delete("General");
  return categories.size ? [...categories] : ["General"];
}
