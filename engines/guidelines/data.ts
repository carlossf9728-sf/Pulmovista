/**
 * Contenido SIMULADO — pendiente de cargar el texto real de cada
 * recomendación. No inventar contenido clínico aquí: esta fase solo deja
 * la arquitectura (GuidelineDefinition + GuidelineRecommendation)
 * preparada para la siguiente gran fase, en la que se cargarán guías
 * reales de bronquiectasias, EPOC, EPID, fibrosis quística, hipertensión
 * pulmonar y trasplante, y se implementará RAG.
 */
import type { GuidelineDefinition, GuidelineRecommendation } from "@/types/guideline";

export const GUIDELINE_DEFINITIONS: GuidelineDefinition[] = [
  {
    guidelineId: "ers-bx-2025",
    source: { sourceId: "ers", society: "European Respiratory Society", title: "ERS Bronchiectasis Guidelines", year: 2025 },
    disease: "Bronquiectasias",
    section: "Manejo de exacerbaciones",
    page: null,
    keywords: ["exacerbación", "bronquiectasias"],
  },
  {
    guidelineId: "gold-2026",
    source: {
      sourceId: "gold",
      society: "Global Initiative for Chronic Obstructive Lung Disease",
      title: "GOLD Report",
      year: 2026,
    },
    disease: "EPOC",
    section: "Tratamiento farmacológico escalonado",
    page: null,
    keywords: ["epoc", "tratamiento"],
  },
  {
    guidelineId: "ats-ers-ipf-2024",
    source: {
      sourceId: "ats-ers-jrs-alat",
      society: "ATS/ERS/JRS/ALAT",
      title: "ATS/ERS/JRS/ALAT — Fibrosis Pulmonar Idiopática",
      year: 2024,
    },
    disease: "Fibrosis pulmonar",
    section: "Terapia antifibrótica",
    page: null,
    keywords: ["fibrosis", "antifibrótico"],
  },
];

export const GUIDELINE_RECOMMENDATIONS: GuidelineRecommendation[] = GUIDELINE_DEFINITIONS.map((def) => ({
  recommendationId: `${def.guidelineId}-rec-1`,
  guidelineId: def.guidelineId,
  title: def.section ?? def.source.title,
  conditions: [],
  recommendationText: "Contenido simulado — pendiente de cargar el texto real de la recomendación.",
  evidenceLevel: null,
}));
