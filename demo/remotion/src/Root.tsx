import React from 'react';
import { Composition, staticFile } from 'remotion';
import { Demo, Manifest } from './Demo';

// Everything about the video's shape -- duration, fps, size -- comes from the
// manifest the rig wrote. Nothing here is hand-tuned to a particular capture.
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Demo"
    component={Demo}
    defaultProps={{ scene: 'recipe-preview', manifest: null as unknown as Manifest }}
    // Placeholders; calculateMetadata overrides all of these from the manifest.
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    calculateMetadata={async ({ props }) => {
      const res = await fetch(staticFile(`out/${props.scene}/manifest.json`));
      if (!res.ok) throw new Error(`no manifest for scene "${props.scene}" -- capture it first`);
      const manifest: Manifest = await res.json();
      return {
        props: { ...props, manifest },
        durationInFrames: manifest.durationFrames,
        fps: manifest.fps,
        // Compose at logical size; the frames are deviceScaleFactor larger and
        // get supersampled down, which is the point of capturing at 2x.
        width: manifest.width,
        height: manifest.height,
      };
    }}
  />
);
