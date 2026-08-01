// The Stage A -> Stage B contract. Stage B (Remotion) never touches a browser;
// it reads only frames, wavs and this file. Every coordinate here is in
// CAPTURED-FRAME PIXELS (i.e. CSS px already multiplied by deviceScaleFactor),
// and every time is a frame index. t_seconds = frame / fps.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Minimal RIFF/WAVE walk. CDP does not write a bare fmt+data file: it emits a
 * PEAK chunk (which carries a timestamp) and a LIST/adtl note (which carries a
 * DATE string) ahead of the audio. Both change on every render, so anything
 * comparing two renders must compare the `data` chunk, never the whole file.
 */
export function wavInfo(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let channels = 0, sampleRate = 0, bitsPerSample = 0;
  let dataStart = -1, dataBytes = 0;
  const chunks = [];
  let p = 12;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    chunks.push({ id, size, at: p });
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(p + 10);
      sampleRate = buf.readUInt32LE(p + 12);
      bitsPerSample = buf.readUInt16LE(p + 22);
    } else if (id === 'data') {
      dataStart = p + 8;
      dataBytes = size;
      break;
    }
    p += 8 + size + (size & 1);    // chunks are word-aligned
  }
  if (dataStart < 0) throw new Error('no data chunk');
  const frames = dataBytes / (channels * (bitsPerSample / 8));
  return { channels, sampleRate, bitsPerSample, frames, seconds: frames / sampleRate, dataStart, dataBytes, chunks };
}

/** The PCM payload alone -- the only part of a CDP render that is reproducible. */
export function wavData(buf) {
  const { dataStart, dataBytes } = wavInfo(buf);
  return buf.subarray(dataStart, dataStart + dataBytes);
}

function appCommit() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

export function createManifest({ outDir, scene, fps, width, height, scale, capturedAt }) {
  const audio = [];
  const beats = [];

  return {
    /** @param {{id,file,startFrame,sampleRate,seconds}} entry */
    addAudio(entry) { audio.push(entry); return entry.id; },
    addBeat(beat) { beats.push(beat); return beat; },

    write(durationFrames) {
      const doc = {
        version: 1,
        scene,
        fps, width, height, deviceScaleFactor: scale,
        framePattern: 'frames/frame-%06d.png',
        durationFrames,
        audio,
        beats,
        meta: {
          appCommit: appCommit(),
          // Injected by the caller: Date.now() is fine in the rig (Node side),
          // but keep it a single explicit value so captures stay diffable.
          capturedAt,
          coordinateSpace: 'captured-frame-pixels (css * deviceScaleFactor)',
        },
      };
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(doc, null, 2));
      return doc;
    },
  };
}
