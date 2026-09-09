import { captureFragment } from "../fragment";
import { EXERCISE_TEST_TRIGGER } from "../keywords";

export interface ExerciseTestExtraction {
  label: string;
  fragment: string;
}

export function extractExerciseTest(segmentText: string, isExplicitHeader: boolean): ExerciseTestExtraction | null {
  if (isExplicitHeader) {
    return { label: "Prueba de esfuerzo", fragment: segmentText.trim() };
  }
  const captured = captureFragment(segmentText, EXERCISE_TEST_TRIGGER);
  if (!captured) return null;
  return { label: captured.label, fragment: captured.fragment };
}
