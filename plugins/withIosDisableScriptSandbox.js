/**
 * Expo config plugin: disable Xcode User Script Sandboxing on iOS.
 *
 * Xcode 15+ enables ENABLE_USER_SCRIPT_SANDBOXING by default. React Native /
 * Expo build phases (Bundle React Native code, CocoaPods resource scripts) invoke
 * tools like `find` across the project tree — the sandbox blocks those reads and
 * the build fails with "Sandbox: find(...) deny(1) file-read-data".
 *
 * Applied on every `expo prebuild` so the fix survives native regeneration.
 */
const { withXcodeProject } = require('expo/config-plugins');

const withIosDisableScriptSandbox = (config) =>
  withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const entry = configurations[key];
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });

module.exports = withIosDisableScriptSandbox;
