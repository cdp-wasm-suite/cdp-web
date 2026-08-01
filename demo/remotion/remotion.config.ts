import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');   // lossless source frames; one lossy step at encode
Config.setOverwriteOutput(true);
// The GEM UI is flat colour and hard 1px edges. Give the encoder room so cables
// and type don't ring.
Config.setCrf(16);
