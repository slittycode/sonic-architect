/**
 * Ableton .als File Parser
 *
 * Parses Ableton Live Set files (gzip-compressed XML) entirely in the browser
 * using DecompressionStream + DOMParser. Extracts:
 *   - BPM / time signature
 *   - Track layout (audio, MIDI, return, master)
 *   - Device chains (instruments, effects)
 *   - Sample references
 *
 * No server required — pure browser-native APIs.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AbletonDevice {
  /** Device class name, e.g. "Compressor2", "AutoFilter", "PluginDevice" */
  className: string;
  /** User-visible name (if set) */
  name: string;
  /** Whether the device is currently enabled */
  isOn: boolean;
}

export interface AbletonTrack {
  /** Track type */
  type: 'audio' | 'midi' | 'return' | 'group' | 'master';
  /** User-assigned track name */
  name: string;
  /** Track color index (Ableton's internal palette) */
  colorIndex: number;
  /** Devices on this track */
  devices: AbletonDevice[];
  /** Sample file references (audio tracks only) */
  sampleRefs: string[];
  /** Whether the track is armed for recording */
  armed: boolean;
  /** Whether the track is muted */
  muted: boolean;
}

export interface AbletonSetInfo {
  /** Live version that created the file */
  creator: string;
  /** Schema version */
  schemaVersion: string;
  /** BPM (from the master tempo) */
  bpm: number;
  /** Time signature numerator */
  timeSignatureNumerator: number;
  /** Time signature denominator */
  timeSignatureDenominator: number;
  /** All tracks in the set */
  tracks: AbletonTrack[];
  /** Unique device names used across all tracks */
  uniqueDevices: string[];
  /** Unique sample file paths referenced */
  uniqueSamples: string[];
}

// ── XML Helpers ──────────────────────────────────────────────────────────────

/** Get text content of a direct child element by tag name. */
function getChildValue(parent: Element, tagName: string): string | null {
  const el = parent.querySelector(`:scope > ${tagName}`);
  return el?.getAttribute('Value') ?? el?.textContent ?? null;
}

/** Get a numeric attribute, with fallback. */
function getNumAttr(el: Element, attr: string, fallback: number): number {
  const raw = el.getAttribute(attr);
  if (raw === null) return fallback;
  const num = parseFloat(raw);
  return Number.isFinite(num) ? num : fallback;
}

/** Parse boolean from attribute value. */
function getBoolAttr(el: Element, attr: string): boolean {
  return el.getAttribute(attr) === 'true';
}

// ── Device Extraction ────────────────────────────────────────────────────────

function parseDevices(deviceChainEl: Element | null): AbletonDevice[] {
  if (!deviceChainEl) return [];

  const devices: AbletonDevice[] = [];

  // Ableton nests devices under DeviceChain > Devices or DeviceChain > DeviceChain > Devices
  const devicesContainers = deviceChainEl.querySelectorAll('Devices');

  for (const container of devicesContainers) {
    for (const child of container.children) {
      const className = child.tagName;
      // Skip non-device elements
      if (className === 'Devices') continue;

      const nameEl = child.querySelector(':scope > UserName');
      const effectiveNameEl = child.querySelector(':scope > Name');
      const isOnEl = child.querySelector(':scope > On > Manual');

      const name =
        nameEl?.getAttribute('Value') ||
        effectiveNameEl?.getAttribute('Value') ||
        className;

      const isOn = isOnEl ? isOnEl.getAttribute('Value') === 'true' : true;

      devices.push({ className, name, isOn });
    }
  }

  return devices;
}

// ── Track Extraction ─────────────────────────────────────────────────────────

function parseTrack(
  el: Element,
  type: AbletonTrack['type']
): AbletonTrack {
  const nameEl = el.querySelector(':scope > Name > EffectiveName');
  const name = nameEl?.getAttribute('Value') ?? `Untitled ${type}`;

  const colorEl = el.querySelector(':scope > ColorIndex');
  const colorIndex = colorEl ? parseInt(colorEl.getAttribute('Value') ?? '0', 10) : 0;

  const armedEl = el.querySelector(':scope > DeviceChain > MainSequencer > ArmedState');
  const armed = armedEl ? armedEl.getAttribute('Value') === 'true' : false;

  const muteEl = el.querySelector(':scope > DeviceChain > Mixer > Speaker > Manual');
  const muted = muteEl ? muteEl.getAttribute('Value') === 'false' : false;

  const deviceChain = el.querySelector(':scope > DeviceChain');
  const devices = parseDevices(deviceChain);

  // Extract sample references
  const sampleRefs: string[] = [];
  const sampleRefEls = el.querySelectorAll('SampleRef FileRef');
  for (const ref of sampleRefEls) {
    const path = ref.querySelector(':scope > Path')?.getAttribute('Value');
    const name = ref.querySelector(':scope > Name')?.getAttribute('Value');
    if (path || name) {
      sampleRefs.push(path || name || '');
    }
  }

  return {
    type,
    name,
    colorIndex,
    devices,
    sampleRefs: [...new Set(sampleRefs)], // deduplicate
    armed,
    muted,
  };
}

// ── Decompression ────────────────────────────────────────────────────────────

/**
 * Decompress a gzip file using the native DecompressionStream API.
 * Falls back to reading as raw text if decompression fails (already XML).
 */
async function decompressGzip(file: File): Promise<string> {
  try {
    const ds = new DecompressionStream('gzip');
    const decompressed = file.stream().pipeThrough(ds);
    const reader = decompressed.getReader();

    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }

    // Concatenate chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return new TextDecoder().decode(combined);
  } catch {
    // Might already be XML (uncompressed) — try reading as text
    return await file.text();
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse an Ableton Live Set (.als) file.
 *
 * @param file - The .als File from a file input or drag-and-drop
 * @returns Parsed set information
 * @throws Error if the file cannot be parsed
 */
export async function parseAbletonSet(file: File): Promise<AbletonSetInfo> {
  const xmlText = await decompressGzip(file);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Failed to parse .als XML: ${parseError.textContent?.slice(0, 200)}`);
  }

  const ableton = doc.documentElement;
  if (!ableton || ableton.tagName !== 'Ableton') {
    throw new Error('Not a valid Ableton Live Set file');
  }

  const creator = ableton.getAttribute('Creator') ?? 'Unknown';
  const schemaVersion = ableton.getAttribute('SchemaChangeCount') ?? '';

  const liveSet = ableton.querySelector('LiveSet');
  if (!liveSet) {
    throw new Error('No LiveSet element found');
  }

  // --- BPM ---
  const tempoEl = liveSet.querySelector('MasterTrack AutomationEnvelopes Envelopes AutomationEnvelope EnvelopeTarget PointeeId');
  // Direct tempo value (more reliable)
  const manualTempoEl = liveSet.querySelector('MasterTrack DeviceChain Mixer Tempo Manual');
  const bpm = manualTempoEl ? getNumAttr(manualTempoEl, 'Value', 120) : 120;

  // --- Time Signature ---
  const tsNumEl = liveSet.querySelector('MasterTrack TimeSignature TimeSignatures RemoteableTimeSignature Numerator');
  const tsDenEl = liveSet.querySelector('MasterTrack TimeSignature TimeSignatures RemoteableTimeSignature Denominator');
  const timeSignatureNumerator = tsNumEl ? getNumAttr(tsNumEl, 'Value', 4) : 4;
  const timeSignatureDenominator = tsDenEl ? getNumAttr(tsDenEl, 'Value', 4) : 4;

  // --- Tracks ---
  const tracks: AbletonTrack[] = [];

  const audioTracks = liveSet.querySelectorAll(':scope > Tracks > AudioTrack');
  for (const t of audioTracks) tracks.push(parseTrack(t, 'audio'));

  const midiTracks = liveSet.querySelectorAll(':scope > Tracks > MidiTrack');
  for (const t of midiTracks) tracks.push(parseTrack(t, 'midi'));

  const groupTracks = liveSet.querySelectorAll(':scope > Tracks > GroupTrack');
  for (const t of groupTracks) tracks.push(parseTrack(t, 'group'));

  const returnTracks = liveSet.querySelectorAll(':scope > Tracks > ReturnTrack');
  for (const t of returnTracks) tracks.push(parseTrack(t, 'return'));

  // Master track
  const masterTrackEl = liveSet.querySelector(':scope > MasterTrack');
  if (masterTrackEl) {
    tracks.push(parseTrack(masterTrackEl, 'master'));
  }

  // --- Aggregations ---
  const allDevices = tracks.flatMap((t) => t.devices.map((d) => d.className));
  const uniqueDevices = [...new Set(allDevices)].sort();

  const allSamples = tracks.flatMap((t) => t.sampleRefs);
  const uniqueSamples = [...new Set(allSamples)].sort();

  return {
    creator,
    schemaVersion,
    bpm,
    timeSignatureNumerator,
    timeSignatureDenominator,
    tracks,
    uniqueDevices,
    uniqueSamples,
  };
}

/**
 * Check if a file is an Ableton Live Set by extension.
 */
export function isAbletonFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.als');
}
