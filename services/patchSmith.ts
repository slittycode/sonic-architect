import { AudioFeatures } from '../types';

export function calculateSynthParams(features: AudioFeatures) {
  // 1. Envelope from Crest Factor
  // Crest factor: peak-to-RMS ratio in dB.
  // High crest factor (> 12) = punchy, percussive -> short attack, short decay
  // Low crest factor (< 6) = squashed, sustained -> longer attack, high sustain
  let attack = 0.05; // seconds
  let decay = 0.5;
  let sustain = 0.5; // 0-1
  let release = 0.3;

  if (features.crestFactor > 12) {
    // Very transient / pluck
    attack = 0.005;
    decay = 0.2;
    sustain = 0.1;
    release = 0.2;
  } else if (features.crestFactor < 6) {
    // Sustained / compressed pad
    attack = 0.5;
    decay = 1.0;
    sustain = 0.9;
    release = 0.8;
  }

  // 2. Filter Cutoff from Spectral Centroid
  // SC ranges from e.g. 200Hz to 10000Hz+
  const cutoffHz = Math.max(200, Math.min(20000, features.spectralCentroidMean || 1000));
  // Map Hz to MIDI note (for Vital)
  const cutoffMidi = Math.max(0, Math.min(127, 69 + 12 * Math.log2(cutoffHz / 440)));

  // 3. Oscillator Waveform from Spectral Bands
  // If Highs are dominant, use saw. If Lows dominant and Highs absent, use sine. Otherwise square.
  const highs = features.spectralBands.find(b => b.name === 'Highs')?.averageDb ?? -100;
  const lows = features.spectralBands.find(b => b.name === 'Sub Bass')?.averageDb ?? -100;
  
  let waveform = 'sine';
  let operatorWave = 0; // 0 = sine, 1 = saw, 2 = square
  
  if (highs > -30) {
    waveform = 'sawtooth';
    operatorWave = 1;
  } else if (lows > -20 && highs < -50) {
    waveform = 'sine';
    operatorWave = 0;
  } else {
    waveform = 'square';
    operatorWave = 2;
  }

  return { attack, decay, sustain, release, cutoffHz, cutoffMidi, waveform, operatorWave };
}

export function generateVitalPatch(features: AudioFeatures): string {
  const params = calculateSynthParams(features);
  
  const vitalPatch = {
    plugin_version: "1.5.5",
    author: "Patch Smith by Sonic Architect",
    name: "Auto-Generated Blueprint",
    settings: {
      osc_1_on: 1,
      osc_1_waveform: params.waveform,
      filter_1_on: 1,
      filter_1_cutoff: Math.round(params.cutoffMidi * 100) / 100,
      env_1_attack: params.attack,
      env_1_decay: params.decay,
      env_1_sustain: params.sustain,
      env_1_release: params.release,
      volume: 0.8
    }
  };

  return JSON.stringify(vitalPatch, null, 2);
}

export function generateOperatorPatch(features: AudioFeatures): string {
  const params = calculateSynthParams(features);
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="11.0_11300" SchemaChangeCount="3" Creator="Ableton Live 11.0.0">
	<Preset>
		<Label>Patch Smith Generated</Label>
		<Operator>
			<OscillatorA>
				<Waveform Value="${params.operatorWave}" />
			</OscillatorA>
			<Filter>
				<Cutoff Value="${Math.round(params.cutoffHz)}" />
				<FilterType Value="0" /> <!-- Lowpass -->
			</Filter>
			<Envelope>
				<Attack Value="${Math.round(params.attack * 1000)}" />
				<Decay Value="${Math.round(params.decay * 1000)}" />
				<Sustain Value="${params.sustain}" />
				<Release Value="${Math.round(params.release * 1000)}" />
			</Envelope>
		</Operator>
	</Preset>
</Ableton>`;

  return xml.trim();
}
