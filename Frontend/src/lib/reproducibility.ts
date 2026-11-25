import { PaperAnalysis, ReproducibilityAssessment, ReproducibilityCriterion } from '@/types';

export interface ReproducibilityRubricInput {
  hasDatasetInfo: boolean;
  datasetEvidence?: string;
  hasModelArchitecture: boolean;
  architectureEvidence?: string;
  hasHyperparameters: boolean;
  hyperparametersEvidence?: string;
  hasTrainingConfig: boolean;
  trainingEvidence?: string;
  hasEvaluationMetrics: boolean;
  metricsEvidence?: string;
  hasSoftwareDependencies: boolean;
  dependenciesEvidence?: string;
  hasExperimentalEnvironment: boolean;
  environmentEvidence?: string;
  challenges?: string[];
  recommendations?: string[];
}

export const REPRODUCIBILITY_DISCLAIMER =
  'This score represents documentation completeness based on the paper text, NOT guaranteed experimental reproducibility.';

export function calculateReproducibilityScore(input: ReproducibilityRubricInput): ReproducibilityAssessment {
  const criteriaSpec: Array<{
    label: string;
    weight: number;
    available: boolean;
    evidence: string;
    recommendation: string;
  }> = [
    {
      label: 'Dataset Information',
      weight: 15,
      available: input.hasDatasetInfo,
      evidence: input.datasetEvidence || '',
      recommendation: 'Specify dataset names, version/DOI, sample counts, and train/val/test split ratios.',
    },
    {
      label: 'Model Architecture',
      weight: 15,
      available: input.hasModelArchitecture,
      evidence: input.architectureEvidence || '',
      recommendation: 'Document exact layer dimensions, backbone variant, activation functions, and loss formulation.',
    },
    {
      label: 'Hyperparameters',
      weight: 15,
      available: input.hasHyperparameters,
      evidence: input.hyperparametersEvidence || '',
      recommendation: 'Report learning rate, batch size, optimizer parameters, weight decay, and dropout rates.',
    },
    {
      label: 'Training Configuration',
      weight: 15,
      available: input.hasTrainingConfig,
      evidence: input.trainingEvidence || '',
      recommendation: 'Include epoch count, scheduler details, early stopping criteria, and random seed settings.',
    },
    {
      label: 'Evaluation Metrics',
      weight: 15,
      available: input.hasEvaluationMetrics,
      evidence: input.metricsEvidence || '',
      recommendation: 'Define exact evaluation formulas, averaging strategy (macro/micro), and confidence intervals.',
    },
    {
      label: 'Software Dependencies',
      weight: 15,
      available: input.hasSoftwareDependencies,
      evidence: input.dependenciesEvidence || '',
      recommendation: 'Publish pinned framework versions (e.g., PyTorch, CUDA, Python) or a requirements.txt.',
    },
    {
      label: 'Experimental Environment',
      weight: 10,
      available: input.hasExperimentalEnvironment,
      evidence: input.environmentEvidence || '',
      recommendation: 'Document GPU/CPU hardware specs, memory footprint, and training runtime.',
    },
  ];

  let score = 0;
  const criteria_breakdown: ReproducibilityCriterion[] = [];
  const available_information: Array<{ criterion: string; weight: number; evidence: string }> = [];
  const missing_information: Array<{ criterion: string; weight: number; reason: string }> = [];
  const autoRecommendations: string[] = [];

  for (const item of criteriaSpec) {
    criteria_breakdown.push({
      criterion: item.label,
      weight: item.weight,
      available: item.available,
      evidence: item.available ? item.evidence || 'Documented in paper' : item.evidence || 'Not specified in paper',
    });

    if (item.available) {
      score += item.weight;
      available_information.push({
        criterion: item.label,
        weight: item.weight,
        evidence: item.evidence || 'Documented in paper',
      });
    } else {
      missing_information.push({
        criterion: item.label,
        weight: item.weight,
        reason: item.evidence || 'Not explicitly documented in extracted paper text',
      });
      autoRecommendations.push(item.recommendation);
    }
  }

  return {
    score,
    max_score: 100,
    disclaimer: REPRODUCIBILITY_DISCLAIMER,
    criteria_breakdown,
    available_information,
    missing_information,
    challenges: input.challenges && input.challenges.length > 0
      ? input.challenges
      : missing_information.map((m) => `Missing ${m.criterion.toLowerCase()} increases trial-and-error during replication.`),
    recommendations:
      input.recommendations && input.recommendations.length > 0 ? input.recommendations : autoRecommendations,
  };
}

export function deriveReproducibilityFromAnalysis(analysis: PaperAnalysis): ReproducibilityAssessment {
  if (
    analysis.reproducibility_assessment &&
    typeof analysis.reproducibility_assessment.score === 'number' &&
    Array.isArray(analysis.reproducibility_assessment.criteria_breakdown) &&
    analysis.reproducibility_assessment.criteria_breakdown.length > 0
  ) {
    return {
      ...analysis.reproducibility_assessment,
      disclaimer: analysis.reproducibility_assessment.disclaimer || REPRODUCIBILITY_DISCLAIMER,
    };
  }

  const datasets = analysis.dataset_information?.datasets || [];
  const hyperparams = analysis.methodology?.hyperparameters || [];
  const hasTraining = Boolean(
    analysis.methodology?.training_configuration &&
      !analysis.methodology.training_configuration.toLowerCase().includes('not specified')
  );
  const hasArch = Boolean(
    analysis.methodology?.architecture_details &&
      !analysis.methodology.architecture_details.toLowerCase().includes('not specified')
  );
  const tech = analysis.technologies_used || [];

  return calculateReproducibilityScore({
    hasDatasetInfo: datasets.length > 0,
    datasetEvidence: datasets.map((d) => d.name).join(', '),
    hasModelArchitecture: hasArch || (analysis.algorithms_used?.length ?? 0) > 0,
    architectureEvidence: analysis.methodology?.architecture_details || '',
    hasHyperparameters: hyperparams.length > 0,
    hyperparametersEvidence: hyperparams.map((h) => `${h.name}: ${h.value}`).join('; '),
    hasTrainingConfig: hasTraining,
    trainingEvidence: analysis.methodology?.training_configuration || '',
    hasEvaluationMetrics: (analysis.evaluation_metrics?.length ?? 0) > 0,
    metricsEvidence: (analysis.evaluation_metrics || []).map((m) => m.metric_name).join(', '),
    hasSoftwareDependencies: tech.length > 0,
    dependenciesEvidence: tech.join(', '),
    hasExperimentalEnvironment: false,
    environmentEvidence: 'Hardware/OS details not explicitly extracted',
  });
}
