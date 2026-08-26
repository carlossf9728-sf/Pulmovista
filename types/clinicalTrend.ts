/**
 * Vocabulario compartido para el cambio longitudinal clínicamente
 * interpretado — deliberadamente solo 3 resultados, iguales en todos los
 * dominios (radiología, función pulmonar, exacerbaciones…):
 *
 *   - "Empeoramiento" → etiqueta roja
 *   - "Mejoría"       → etiqueta verde
 *   - null            → sin etiqueta destacada
 *
 * Dos capas separadas, siempre:
 *   1. Cambio longitudinal OBJETIVO — qué ha cambiado realmente (texto
 *      descriptivo neutro, sin esta etiqueta).
 *   2. Interpretación clínica (`ClinicalTrend`) — si ese cambio
 *      representa CLARAMENTE mejoría o empeoramiento. Si no se puede
 *      defender con seguridad, se queda en `null`: PulmoVista nunca
 *      convierte automáticamente "cambio" en "empeoramiento", y nunca
 *      inventa un umbral nuevo para decidirlo — solo reutiliza criterios
 *      ya establecidos en la app (ver domain/timeline.ts,
 *      domain/radiologyTrend.ts) o el propio texto explícito del dato
 *      (informe de imagen).
 */
export type ClinicalTrend = "Empeoramiento" | "Mejoría" | null;
