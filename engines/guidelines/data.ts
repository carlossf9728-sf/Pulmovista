/**
 * Contenido SIMULADO — stub original de la Fase 4, mantenido sin cambios
 * de comportamiento. NO representa las guías reales de bronquiectasias
 * (esas viven en engines/guidelines/knowledge/, separadas y todavía sin
 * conectar a la interfaz ni a los motores clínicos). Este stub solo se
 * ha ajustado mecánicamente al nuevo shape de tipos (GuidelineDocument,
 * GuidelineRecommendation con cita) para seguir compilando; su contenido
 * sigue siendo un marcador de posición honesto ("Contenido simulado…").
 */
import type { GuidelineDocument, GuidelineRecommendation } from "@/types/guideline";

export const GUIDELINE_DOCUMENTS: GuidelineDocument[] = [
  {
    guidelineId: "ers-bx-2025",
    source: { sourceId: "ers", society: "European Respiratory Society", title: "ERS Bronchiectasis Guidelines", year: 2025 },
    disease: "Bronquiectasias",
    section: "Manejo de exacerbaciones",
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
    keywords: ["fibrosis", "antifibrótico"],
  },
];

export const GUIDELINE_RECOMMENDATIONS: GuidelineRecommendation[] = GUIDELINE_DOCUMENTS.map((doc) => ({
  recommendationId: `${doc.guidelineId}-rec-1`,
  guidelineId: doc.guidelineId,
  section: null,
  page: null,
  sourceText: "Contenido simulado — pendiente de cargar el texto real de la recomendación.",
  topic: "tratamiento antibiótico",
  recommendationText: "Contenido simulado — pendiente de cargar el texto real de la recomendación.",
  applicability: "conditional",
  criteria: [],
  exclusions: [],
  prerequisites: [],
  strength: null,
  evidenceQuality: null,
  keywords: doc.keywords,
}));
