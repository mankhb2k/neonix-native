import { Config } from "@remotion/cli/config";
import { remotionWebpackOverride } from "./src/webpack-override";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(remotionWebpackOverride);
