/**
 * Analítica — el parser estilo IANUS (parseLabBlock, sin cambios) se
 * ejecuta SOLO sobre el segmento de laboratorio, nunca sobre el
 * documento completo: así un bloque de parámetros no puede arrastrar la
 * consulta, el TC, el cultivo o el tratamiento que vengan antes o
 * después en el texto pegado.
 */
import { captureFragment } from "../fragment";
import { parseLabBlock } from "../labParameters";
import { LAB_TRIGGER } from "../keywords";
import type { LabParameter } from "@/types/clinicalEvent";

export interface LabExtraction {
  fragment: string;
  parameters: LabParameter[];
  unparsedLines: string[];
}

export function extractLabResults(segmentText: string, isExplicitHeader: boolean): LabExtraction | null {
  const block = parseLabBlock(segmentText);
  if (block.parameters.length) {
    return { fragment: segmentText.trim(), parameters: block.parameters, unparsedLines: block.unparsedLines };
  }
  if (isExplicitHeader) {
    // El encabezado ya confirma la categoría aunque no se haya podido estructurar ningún parámetro — se
    // conserva el segmento completo (es, por definición, solo el contenido de esta sección) para revisión.
    return { fragment: segmentText.trim(), parameters: [], unparsedLines: [] };
  }
  const captured = captureFragment(segmentText, LAB_TRIGGER);
  if (!captured) return null;
  return { fragment: captured.fragment, parameters: [], unparsedLines: [] };
}
