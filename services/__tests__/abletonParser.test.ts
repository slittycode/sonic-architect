import { describe, it, expect } from 'vitest';
import { parseAbletonSet, isAbletonFile } from '../abletonParser';

/**
 * Construct a minimal Ableton .als XML string for testing.
 * The parser's decompressGzip falls back to file.text() when
 * DecompressionStream is unavailable (jsdom), so we pass raw XML.
 */
function makeAlsXml(options: {
  bpm?: number;
  tsNum?: number;
  tsDen?: number;
  tracks?: string;
  creator?: string;
} = {}): string {
  const {
    bpm = 120,
    tsNum = 4,
    tsDen = 4,
    tracks = '',
    creator = 'Ableton Live 12.0',
  } = options;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Ableton Creator="${creator}" SchemaChangeCount="3">
  <LiveSet>
    <MasterTrack>
      <Name>
        <EffectiveName Value="Master" />
      </Name>
      <ColorIndex Value="0" />
      <DeviceChain>
        <Mixer>
          <Tempo>
            <Manual Value="${bpm}" />
          </Tempo>
          <Speaker>
            <Manual Value="true" />
          </Speaker>
        </Mixer>
        <Devices>
          <Limiter>
            <UserName Value="Limiter" />
            <On><Manual Value="true" /></On>
          </Limiter>
        </Devices>
      </DeviceChain>
      <TimeSignature>
        <TimeSignatures>
          <RemoteableTimeSignature>
            <Numerator Value="${tsNum}" />
            <Denominator Value="${tsDen}" />
          </RemoteableTimeSignature>
        </TimeSignatures>
      </TimeSignature>
    </MasterTrack>
    <Tracks>
      ${tracks}
    </Tracks>
  </LiveSet>
</Ableton>`;
}

function makeAudioTrack(name: string, devices: string = '', samples: string = ''): string {
  return `<AudioTrack>
    <Name><EffectiveName Value="${name}" /></Name>
    <ColorIndex Value="5" />
    <DeviceChain>
      <Mixer><Speaker><Manual Value="true" /></Speaker></Mixer>
      <Devices>${devices}</Devices>
      ${samples}
    </DeviceChain>
  </AudioTrack>`;
}

function makeMidiTrack(name: string, devices: string = ''): string {
  return `<MidiTrack>
    <Name><EffectiveName Value="${name}" /></Name>
    <ColorIndex Value="3" />
    <DeviceChain>
      <Mixer><Speaker><Manual Value="true" /></Speaker></Mixer>
      <Devices>${devices}</Devices>
    </DeviceChain>
  </MidiTrack>`;
}

function makeReturnTrack(name: string, devices: string = ''): string {
  return `<ReturnTrack>
    <Name><EffectiveName Value="${name}" /></Name>
    <ColorIndex Value="1" />
    <DeviceChain>
      <Mixer><Speaker><Manual Value="true" /></Speaker></Mixer>
      <Devices>${devices}</Devices>
    </DeviceChain>
  </ReturnTrack>`;
}

/** Create a mock File from an XML string. */
function xmlToFile(xml: string, name = 'test.als'): File {
  return new File([xml], name, { type: 'application/octet-stream' });
}

describe('Ableton .als Parser', () => {
  it('parses a minimal .als with BPM and time signature', async () => {
    const xml = makeAlsXml({ bpm: 128, tsNum: 3, tsDen: 4 });
    const result = await parseAbletonSet(xmlToFile(xml));

    expect(result.bpm).toBe(128);
    expect(result.timeSignatureNumerator).toBe(3);
    expect(result.timeSignatureDenominator).toBe(4);
    expect(result.creator).toBe('Ableton Live 12.0');
  });

  it('extracts audio and MIDI tracks', async () => {
    const tracks = [
      makeAudioTrack('Drums'),
      makeAudioTrack('Bass'),
      makeMidiTrack('Synth Lead'),
    ].join('\n');

    const xml = makeAlsXml({ tracks });
    const result = await parseAbletonSet(xmlToFile(xml));

    // 3 tracks + master = 4 total
    expect(result.tracks.length).toBe(4);

    const audioTracks = result.tracks.filter((t) => t.type === 'audio');
    const midiTracks = result.tracks.filter((t) => t.type === 'midi');
    const masterTracks = result.tracks.filter((t) => t.type === 'master');

    expect(audioTracks).toHaveLength(2);
    expect(midiTracks).toHaveLength(1);
    expect(masterTracks).toHaveLength(1);

    expect(audioTracks[0].name).toBe('Drums');
    expect(midiTracks[0].name).toBe('Synth Lead');
  });

  it('extracts devices from tracks', async () => {
    const devices = `
      <Compressor2>
        <UserName Value="Glue Compressor" />
        <On><Manual Value="true" /></On>
      </Compressor2>
      <Eq8>
        <UserName Value="EQ Eight" />
        <On><Manual Value="false" /></On>
      </Eq8>
    `;
    const tracks = makeAudioTrack('Drums', devices);
    const xml = makeAlsXml({ tracks });
    const result = await parseAbletonSet(xmlToFile(xml));

    const drumsTrack = result.tracks.find((t) => t.name === 'Drums')!;
    expect(drumsTrack.devices).toHaveLength(2);
    expect(drumsTrack.devices[0].className).toBe('Compressor2');
    expect(drumsTrack.devices[0].name).toBe('Glue Compressor');
    expect(drumsTrack.devices[0].isOn).toBe(true);
    expect(drumsTrack.devices[1].className).toBe('Eq8');
    expect(drumsTrack.devices[1].isOn).toBe(false);
  });

  it('collects unique devices across all tracks', async () => {
    const tracks = [
      makeAudioTrack('Drums', '<Compressor2><UserName Value="Comp" /><On><Manual Value="true" /></On></Compressor2>'),
      makeAudioTrack('Bass', '<Compressor2><UserName Value="Comp" /><On><Manual Value="true" /></On></Compressor2><AutoFilter><UserName Value="Filter" /><On><Manual Value="true" /></On></AutoFilter>'),
    ].join('\n');

    const xml = makeAlsXml({ tracks });
    const result = await parseAbletonSet(xmlToFile(xml));

    // Compressor2 appears on both tracks but should be listed once
    // AutoFilter on Bass, Limiter on Master
    expect(result.uniqueDevices).toContain('Compressor2');
    expect(result.uniqueDevices).toContain('AutoFilter');
    expect(result.uniqueDevices).toContain('Limiter');
  });

  it('extracts return tracks', async () => {
    const tracks = [
      makeReturnTrack('Reverb', '<Reverb><UserName Value="Reverb" /><On><Manual Value="true" /></On></Reverb>'),
      makeReturnTrack('Delay', '<Delay><UserName Value="Delay" /><On><Manual Value="true" /></On></Delay>'),
    ].join('\n');

    const xml = makeAlsXml({ tracks });
    const result = await parseAbletonSet(xmlToFile(xml));

    const returnTracks = result.tracks.filter((t) => t.type === 'return');
    expect(returnTracks).toHaveLength(2);
    expect(returnTracks[0].name).toBe('Reverb');
    expect(returnTracks[1].name).toBe('Delay');
  });

  it('throws on invalid XML', async () => {
    const file = xmlToFile('not xml at all <broken');
    await expect(parseAbletonSet(file)).rejects.toThrow();
  });

  it('throws on non-Ableton XML', async () => {
    const file = xmlToFile('<?xml version="1.0"?><NotAbleton/>');
    await expect(parseAbletonSet(file)).rejects.toThrow('Not a valid Ableton');
  });
});

describe('isAbletonFile', () => {
  it('detects .als extension', () => {
    expect(isAbletonFile(new File([], 'myproject.als'))).toBe(true);
    expect(isAbletonFile(new File([], 'SONG.ALS'))).toBe(true);
  });

  it('rejects non-.als files', () => {
    expect(isAbletonFile(new File([], 'song.mp3'))).toBe(false);
    expect(isAbletonFile(new File([], 'project.adg'))).toBe(false);
  });
});
