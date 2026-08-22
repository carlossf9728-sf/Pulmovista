export type DiagnosisCategory = "Bronquiectasias" | "EPOC" | "Fibrosis pulmonar" | "General";

/** Clasifica un diagnóstico libre en una categoría reconocida por los motores dependientes del diagnóstico. */
export function classifyDiagnosis(dx = ""): DiagnosisCategory {
  const d = dx.toLowerCase();
  if (/bronquiect/.test(d)) return "Bronquiectasias";
  if (/epoc/.test(d)) return "EPOC";
  if (/fibrosis|epid|intersticial/.test(d)) return "Fibrosis pulmonar";
  return "General";
}
