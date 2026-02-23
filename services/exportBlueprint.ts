import { ReconstructionBlueprint, ArrangementSection, InstrumentRackElement, FXChainItem } from '../types';

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function downloadJson(blueprint: ReconstructionBlueprint, projectName: string = 'project') {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(blueprint, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `sonic-architect-${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${formatTimestamp()}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function downloadMarkdown(blueprint: ReconstructionBlueprint, projectName: string = 'project') {
  const content = `Sonic Architect — Reconstruction Blueprint

BPM: ${blueprint.telemetry?.bpm || 'Unknown'} | Key: ${blueprint.telemetry?.key || 'Unknown'} | Groove: ${blueprint.telemetry?.groove || 'Unknown'}

Arrangement

| Time | Section | Description |
|---|---|---|
${blueprint.arrangement.map((s: ArrangementSection) => `| ${s.timeRange} | ${s.label} | ${s.description} |`).join('\n')}

Instrumentation

${blueprint.instrumentation.map((i: InstrumentRackElement) => `### ${i.element}
Timbre: ${i.timbre} | Freq: ${i.frequency}
Device: ${i.abletonDevice}`).join('\n\n')}

FX Chain

${blueprint.fxChain.map((f: FXChainItem) => `### ${f.artifact}
Recommendation: ${f.recommendation}`).join('\n\n')}

Secret Sauce

Technique: ${blueprint.secretSauce.trick}
Execution: ${blueprint.secretSauce.execution}
`;

  const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(content);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `sonic-architect-${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${formatTimestamp()}.md`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
