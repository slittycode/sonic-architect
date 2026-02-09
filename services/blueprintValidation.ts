import { ReconstructionBlueprint } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Invalid blueprint at ${path}: expected object`);
  }
  return value;
}

function requireString(
  value: unknown,
  path: string,
): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid blueprint at ${path}: expected non-empty string`);
  }
  return value;
}

function optionalNumber(
  value: unknown,
  path: string,
): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid blueprint at ${path}: expected number`);
  }
  return value;
}

function requireArray(
  value: unknown,
  path: string,
): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid blueprint at ${path}: expected array`);
  }
  return value;
}

export function validateBlueprint(data: unknown): ReconstructionBlueprint {
  const root = requireRecord(data, 'root');

  const telemetryInput = requireRecord(root.telemetry, 'telemetry');
  const telemetry: ReconstructionBlueprint['telemetry'] = {
    bpm: requireString(telemetryInput.bpm, 'telemetry.bpm'),
    key: requireString(telemetryInput.key, 'telemetry.key'),
    groove: requireString(telemetryInput.groove, 'telemetry.groove'),
  };
  const bpmConfidence = optionalNumber(
    telemetryInput.bpmConfidence,
    'telemetry.bpmConfidence',
  );
  const keyConfidence = optionalNumber(
    telemetryInput.keyConfidence,
    'telemetry.keyConfidence',
  );
  if (bpmConfidence != null) telemetry.bpmConfidence = bpmConfidence;
  if (keyConfidence != null) telemetry.keyConfidence = keyConfidence;

  const arrangement = requireArray(root.arrangement, 'arrangement').map((entry, index) => {
    const row = requireRecord(entry, `arrangement[${index}]`);
    return {
      timeRange: requireString(row.timeRange, `arrangement[${index}].timeRange`),
      label: requireString(row.label, `arrangement[${index}].label`),
      description: requireString(row.description, `arrangement[${index}].description`),
    };
  });

  const instrumentation = requireArray(root.instrumentation, 'instrumentation').map((entry, index) => {
    const row = requireRecord(entry, `instrumentation[${index}]`);
    return {
      element: requireString(row.element, `instrumentation[${index}].element`),
      timbre: requireString(row.timbre, `instrumentation[${index}].timbre`),
      frequency: requireString(row.frequency, `instrumentation[${index}].frequency`),
      abletonDevice: requireString(
        row.abletonDevice,
        `instrumentation[${index}].abletonDevice`,
      ),
    };
  });

  const fxChain = requireArray(root.fxChain, 'fxChain').map((entry, index) => {
    const row = requireRecord(entry, `fxChain[${index}]`);
    return {
      artifact: requireString(row.artifact, `fxChain[${index}].artifact`),
      recommendation: requireString(
        row.recommendation,
        `fxChain[${index}].recommendation`,
      ),
    };
  });

  const secretSauceInput = requireRecord(root.secretSauce, 'secretSauce');
  const secretSauce = {
    trick: requireString(secretSauceInput.trick, 'secretSauce.trick'),
    execution: requireString(secretSauceInput.execution, 'secretSauce.execution'),
  };

  let meta: ReconstructionBlueprint['meta'];
  if (root.meta != null) {
    const metaInput = requireRecord(root.meta, 'meta');
    meta = {
      provider: requireString(metaInput.provider, 'meta.provider'),
      analysisTime: optionalNumber(metaInput.analysisTime, 'meta.analysisTime') ?? 0,
      sampleRate: optionalNumber(metaInput.sampleRate, 'meta.sampleRate') ?? 0,
      duration: optionalNumber(metaInput.duration, 'meta.duration') ?? 0,
      channels: optionalNumber(metaInput.channels, 'meta.channels') ?? 0,
    };
  }

  return {
    telemetry,
    arrangement,
    instrumentation,
    fxChain,
    secretSauce,
    meta,
  };
}
