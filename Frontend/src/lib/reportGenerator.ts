import { jsPDF } from 'jspdf';
import { ProjectBundle } from '@/types';
import { deriveReproducibilityFromAnalysis } from './reproducibility';

function sanitizePdfText(input: string): string {
  return input
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u2192/g, '->')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u00b1/g, '+/-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

export function generateFinalReportPdf(bundle: ProjectBundle): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 56;

  const ensureSpace = (needed = 40) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 54;
    }
  };

  const addHeading = (title: string) => {
    ensureSpace(44);
    y += 8;
    doc.setFillColor(22, 27, 64);
    doc.rect(margin, y - 14, maxWidth, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(sanitizePdfText(title), margin + 8, y + 1);
    y += 22;
    doc.setTextColor(25, 30, 50);
  };

  const addBody = (text: string, indent = 0) => {
    if (!text) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(sanitizePdfText(text), maxWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, margin + indent, y);
      y += 14;
    }
    y += 4;
  };

  const addBullet = (text: string) => {
    addBody(`- ${text}`, 10);
  };

  const { project, paper, analysis, blueprints, generatedCode, runs, results } = bundle;
  const selectedBlueprint = blueprints.find((b) => b.is_selected) || blueprints[0];
  const latestRun = runs[0];
  const latestResult = results[0];
  const repro = analysis ? deriveReproducibilityFromAnalysis(analysis) : null;

  // Cover Header
  doc.setFillColor(13, 18, 46);
  doc.rect(0, 0, pageWidth, 118, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Paper2Prototype — Technical Experiment Report', margin, 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253);
  doc.text(`Project: ${project.title}`, margin, 68);
  doc.text(
    `Generated: ${new Date().toLocaleString()}${project.is_demo ? '  |  [DEMO DATA]' : ''}`,
    margin,
    86
  );
  y = 142;

  // 1. Research Paper Overview
  addHeading('1. Research Paper Overview');
  addBody(`Title: ${analysis?.research_title || project.title}`);
  if (paper) {
    addBody(`Source PDF: ${paper.file_name} (${paper.page_count} pages)`);
  }
  addBody(`Abstract: ${analysis?.abstract || 'Not available yet.'}`);

  // 2. Extracted Research Problem
  addHeading('2. Extracted Research Problem & Gap');
  addBody(`Research Problem: ${analysis?.research_problem || 'Not specified.'}`);
  addBody(`Research Gap: ${analysis?.research_gap || 'Not specified.'}`);
  if (analysis?.research_objectives?.length) {
    addBody('Objectives:');
    analysis.research_objectives.forEach((obj) => addBullet(obj));
  }

  // 3. Methodology
  addHeading('3. Methodology & Technical Formulation');
  addBody(`Proposed Solution: ${analysis?.proposed_solution || 'Not specified.'}`);
  if (analysis?.methodology?.summary) {
    addBody(`Methodology Summary: ${analysis.methodology.summary}`);
  }
  if (analysis?.methodology?.pipeline_steps?.length) {
    analysis.methodology.pipeline_steps.forEach((step) => {
      addBullet(`Step ${step.step_number}: ${step.title} — ${step.description} (${step.page_ref || 'paper'})`);
    });
  }
  if (analysis?.algorithms_used?.length) {
    addBody('Algorithms Used:');
    analysis.algorithms_used.forEach((alg) => addBullet(`${alg.name}: ${alg.purpose}`));
  }

  // 4. Experiment Blueprint
  addHeading('4. Experiment Blueprint');
  if (selectedBlueprint) {
    addBody(`Title: ${selectedBlueprint.experiment_title} [${selectedBlueprint.implementation_level.toUpperCase()}]`);
    addBody(`Objective: ${selectedBlueprint.experiment_objective}`);
    addBody(`Complexity: ${selectedBlueprint.estimated_complexity}`);
    addBody(`Inputs: ${selectedBlueprint.input_specifications}`);
    addBody(`Outputs: ${selectedBlueprint.output_specifications}`);
    addBody(`Expected Results (Hypothesized): ${selectedBlueprint.expected_results}`);
  } else {
    addBody('No experiment blueprint generated yet.');
  }

  // 5. Dataset & Resources
  addHeading('5. Datasets & Resources');
  if (analysis?.dataset_recommendations?.length) {
    analysis.dataset_recommendations.forEach((ds) => {
      addBullet(`${ds.name} (${ds.source}) — ${ds.url || 'No direct link'} [${ds.verification_status}]`);
    });
  } else if (analysis?.dataset_information?.datasets?.length) {
    analysis.dataset_information.datasets.forEach((ds) => {
      addBullet(`${ds.name}: ${ds.description} (${ds.size})`);
    });
  } else {
    addBody('No datasets recorded.');
  }

  // 6. Generated Python Code Summary
  addHeading('6. Generated Python Code Summary');
  if (generatedCode) {
    addBody(`Starter Project: ${generatedCode.project_name} (${generatedCode.implementation_level})`);
    addBody(`Files (${generatedCode.files.length}): ${generatedCode.files.map((f) => f.path).join(', ')}`);
    if (generatedCode.simplifications?.length) {
      addBody('Documented Simplifications vs. Full Paper:');
      generatedCode.simplifications.forEach((s) => addBullet(s));
    }
  } else {
    addBody('No code generated yet.');
  }

  // 7. Actual Execution Details
  addHeading('7. Actual Execution Details');
  if (latestRun && latestRun.status !== 'sandbox_not_configured') {
    addBody(`Run Status: ${latestRun.status.toUpperCase()} | Provider: ${latestRun.sandbox_provider || 'External Sandbox'}`);
    addBody(`Entry File: ${latestRun.entry_file} | Exit Code: ${latestRun.exit_code ?? '—'} | Duration: ${latestRun.execution_time_ms ?? '—'} ms`);
    if (latestRun.stdout_log) {
      addBody(`Console Output (excerpt):\n${latestRun.stdout_log.slice(0, 800)}`);
    }
  } else {
    addBody(
      'Not executed in an isolated sandbox yet. No simulated results are fabricated. Download the project ZIP to execute locally or configure SANDBOX_API_URL.'
    );
  }

  // 8. Actual Results
  addHeading('8. Actual Experimental Results');
  if (latestResult && latestResult.is_actual_execution) {
    addBody(latestResult.summary || 'Measured results from isolated sandbox execution:');
    Object.entries(latestResult.metrics || {}).forEach(([k, v]) => {
      addBullet(`${k}: ${String(v)}`);
    });
  } else {
    addBody('No actual execution results available yet.');
  }

  // 9. Evaluation Metrics (Paper Reported vs Actual)
  addHeading('9. Evaluation Metrics (Paper-Reported Reference)');
  if (analysis?.evaluation_metrics?.length) {
    analysis.evaluation_metrics.forEach((m) => {
      addBullet(`${m.metric_name}: ${m.reported_value} (${m.context}, ${m.page_ref || 'paper'})`);
    });
  } else {
    addBody('No paper-reported evaluation metrics extracted.');
  }

  // 10. Limitations
  addHeading('10. Limitations');
  if (analysis?.limitations?.length) {
    analysis.limitations.forEach((lim) => addBullet(lim));
  } else {
    addBody('No explicit limitations extracted.');
  }

  // 11. Reproducibility Assessment
  addHeading('11. Research Reproducibility Assessment');
  if (repro) {
    addBody(`Documentation Completeness Score: ${repro.score} / ${repro.max_score}`);
    addBody(`Disclaimer: ${repro.disclaimer}`);
    repro.criteria_breakdown.forEach((c) => {
      addBullet(`[${c.available ? 'PRESENT' : 'MISSING'}] ${c.criterion} (${c.weight} pts): ${c.evidence}`);
    });
  } else {
    addBody('Reproducibility assessment not available.');
  }

  // 12. References & Source Links
  addHeading('12. References & Source Links');
  let hasAnyRef = false;
  if (analysis?.source_excerpts?.length) {
    hasAnyRef = true;
    analysis.source_excerpts.forEach((ex) => {
      addBullet(`[Page ${ex.page_number}] (${ex.field}): "${ex.excerpt}"`);
    });
  }
  if (analysis?.dataset_recommendations?.length) {
    const withUrls = analysis.dataset_recommendations.filter((d) => d.url);
    if (withUrls.length > 0) {
      hasAnyRef = true;
      withUrls.forEach((d) => addBullet(`${d.name}: ${d.url}`));
    }
  }
  if (analysis?.library_recommendations?.length) {
    const libsWithUrls = analysis.library_recommendations.filter((l) => l.docs_url);
    if (libsWithUrls.length > 0) {
      hasAnyRef = true;
      libsWithUrls.forEach((l) => addBullet(`${l.name} (${l.pip_package}): ${l.docs_url}`));
    }
  }
  if (!hasAnyRef) {
    addBody('No source excerpts or external links recorded yet.');
  }

  return doc;
}
