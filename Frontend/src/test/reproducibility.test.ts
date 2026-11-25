import { describe, expect, it } from 'vitest';
import {
  calculateReproducibilityScore,
  deriveReproducibilityFromAnalysis,
  REPRODUCIBILITY_DISCLAIMER,
} from '@/lib/reproducibility';
import { DEMO_PROJECT_BUNDLE } from '@/data/demoProject';

describe('Research Reproducibility Score', () => {
  it('scores 100 when all 7 criteria are documented', () => {
    const result = calculateReproducibilityScore({
      hasDatasetInfo: true,
      hasModelArchitecture: true,
      hasHyperparameters: true,
      hasTrainingConfig: true,
      hasEvaluationMetrics: true,
      hasSoftwareDependencies: true,
      hasExperimentalEnvironment: true,
    });

    expect(result.score).toBe(100);
    expect(result.max_score).toBe(100);
    expect(result.available_information).toHaveLength(7);
    expect(result.missing_information).toHaveLength(0);
    expect(result.disclaimer).toBe(REPRODUCIBILITY_DISCLAIMER);
  });

  it('scores 0 and lists recommendations when nothing is documented', () => {
    const result = calculateReproducibilityScore({
      hasDatasetInfo: false,
      hasModelArchitecture: false,
      hasHyperparameters: false,
      hasTrainingConfig: false,
      hasEvaluationMetrics: false,
      hasSoftwareDependencies: false,
      hasExperimentalEnvironment: false,
    });

    expect(result.score).toBe(0);
    expect(result.available_information).toHaveLength(0);
    expect(result.missing_information).toHaveLength(7);
    expect(result.recommendations.length).toBe(7);
  });

  it('computes expected 75/100 score on the Plant Disease Detection demo paper', () => {
    const assessment = deriveReproducibilityFromAnalysis(DEMO_PROJECT_BUNDLE.analysis!);
    expect(assessment.score).toBe(75);
    expect(assessment.missing_information.map((m) => m.criterion)).toEqual([
      'Software Dependencies',
      'Experimental Environment',
    ]);
    expect(assessment.disclaimer.toLowerCase()).toContain('not guaranteed experimental reproducibility');
  });
});
