import React from 'react';
import {
  AbsoluteFill, Audio, Img, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, spring,
} from 'remotion';

export type Rect = { x: number; y: number; w: number; h: number };

export type Manifest = {
  scene: string;
  fps: number;
  width: number;
  height: number;
  deviceScaleFactor: number;
  framePattern: string;
  durationFrames: number;
  audio: { id: string; file: string; startFrame: number; sampleRate: number; seconds: number }[];
  beats: {
    id: string; label: string; startFrame: number; endFrame: number;
    caption: { text: string; startFrame: number; endFrame: number } | null;
    focus: Rect | null;
    audioRef: string | null;
    playhead: { canvasRect: Rect; sampleRate: number; startFrame: number; endFrame: number } | null;
  }[];
};

const framePath = (m: Manifest, scene: string, i: number) =>
  staticFile(`out/${scene}/` + m.framePattern.replace('%06d', String(i).padStart(6, '0')));

/**
 * The captured frames are deviceScaleFactor times the composition size. Focus
 * rects in the manifest are in captured-frame pixels, so divide by the scale to
 * land in composition space.
 */
function useFocusTransform(m: Manifest, frame: number, fps: number) {
  const s = m.deviceScaleFactor;
  const compW = m.width;
  const compH = m.height;

  // The active focus beat, if any. Beats are authored in capture order.
  const beat = m.beats.find((b) => b.focus && frame >= b.startFrame && frame < b.endFrame);
  if (!beat || !beat.focus) return { scale: 1, tx: 0, ty: 0 };

  const r = { x: beat.focus.x / s, y: beat.focus.y / s, w: beat.focus.w / s, h: beat.focus.h / s };

  // Zoom to fit the focus rect, but never past 2.2x -- the frames are captured
  // at 2x, so beyond that we would be upscaling real pixels.
  const target = Math.min(2.2, Math.min(compW / r.w, compH / r.h));

  // Ease in over ~0.6s at the start of the beat, and back out at the end.
  const ramp = spring({ frame: frame - beat.startFrame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.7) });
  const outRamp = 1 - spring({ frame: frame - (beat.endFrame - Math.round(fps * 0.5)), fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.5) });
  const t = Math.min(ramp, Math.max(0, outRamp));

  const scale = 1 + (target - 1) * t;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const tx = (compW / 2 - cx) * scale * t;
  const ty = (compH / 2 - cy) * scale * t;
  return { scale, tx, ty };
}

/**
 * The app's own playhead is never captured: player.playhead() reads
 * audioCtx.currentTime, the real hardware clock, which under the rig's paused
 * virtual clock races ahead of the frames. Draw it here instead, from the same
 * frame numbers that place the audio -- so the sweep and the sound cannot drift.
 */
const Playhead: React.FC<{ m: Manifest; frame: number }> = ({ m, frame }) => {
  const s = m.deviceScaleFactor;
  const beat = m.beats.find((b) => b.playhead && frame >= b.playhead.startFrame && frame < b.playhead.endFrame);
  if (!beat?.playhead) return null;

  const { canvasRect: c, startFrame, endFrame } = beat.playhead;
  const t = (frame - startFrame) / (endFrame - startFrame);
  const x = (c.x + c.w * t) / s;

  return (
    <div style={{
      position: 'absolute',
      left: x, top: c.y / s, width: 2, height: c.h / s,
      background: '#ff2d2d', boxShadow: '0 0 6px rgba(255,45,45,.8)',
    }} />
  );
};

const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 72,
    display: 'flex', justifyContent: 'center',
  }}>
    <div style={{
      font: '500 34px/1.3 ui-monospace, "SF Mono", Menlo, monospace',
      color: '#fff', background: 'rgba(0,0,0,.78)',
      padding: '14px 26px', borderRadius: 6, letterSpacing: '.01em',
    }}>{text}</div>
  </div>
);

export const Demo: React.FC<{ scene: string; manifest: Manifest }> = ({ scene, manifest }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { scale, tx, ty } = useFocusTransform(manifest, frame, fps);

  const i = Math.min(frame, manifest.durationFrames - 1);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        {/* <Img> blocks the frame until decoded, so no half-painted snapshots. */}
        <Img src={framePath(manifest, scene, i)} style={{ width: '100%', height: '100%' }} />
        <Playhead m={manifest} frame={frame} />
      </AbsoluteFill>

      {manifest.audio.map((a) => (
        <Sequence key={a.id} from={a.startFrame} durationInFrames={Math.ceil(a.seconds * fps)}>
          <Audio src={staticFile(`out/${scene}/${a.file}`)} />
        </Sequence>
      ))}

      {manifest.beats
        .filter((b) => b.caption)
        .map((b) => (
          <Sequence
            key={b.id}
            from={b.caption!.startFrame}
            durationInFrames={Math.max(1, b.caption!.endFrame - b.caption!.startFrame)}
          >
            <Caption text={b.caption!.text} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
