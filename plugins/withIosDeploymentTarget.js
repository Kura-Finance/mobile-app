/**
 * Expo config plugin: normalize the iOS deployment target across ALL Pods.
 *
 * CocoaPods resource-bundle targets (e.g. RNCAsyncStorage-resources,
 * RNSVG-RNSVGFilters) keep the deployment target declared in their podspec
 * (12.x / 13.x), which Xcode 15+/16 flags as below the supported minimum (15.0).
 *
 * The Podfile's `platform :ios` line does NOT override those targets, so we
 * inject a loop into the existing `post_install` block that forces every Pod
 * target to the app's deployment target. This runs on every `expo prebuild`,
 * so the warning never comes back.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const DEPLOYMENT_TARGET = '15.1';
const MARKER = '# >>> kura: normalize iOS deployment target';

function buildSnippet() {
  return [
    `    ${MARKER}`,
    `    installer.pods_project.targets.each do |target|`,
    `      target.build_configurations.each do |bc|`,
    `        bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${DEPLOYMENT_TARGET}'`,
    `      end`,
    `    end`,
    `    if installer.respond_to?(:generated_projects)`,
    `      installer.generated_projects.each do |project|`,
    `        project.targets.each do |target|`,
    `          target.build_configurations.each do |bc|`,
    `            bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${DEPLOYMENT_TARGET}'`,
    `          end`,
    `        end`,
    `      end`,
    `    end`,
    `    # <<< kura`,
  ].join('\n');
}

const withIosDeploymentTarget = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return cfg;
      }

      // Insert right after the `react_native_post_install(...)` call so the
      // normalization runs inside the Pods' existing post_install block.
      const anchor = /react_native_post_install\([\s\S]*?\)\n/;
      if (!anchor.test(contents)) {
        return cfg; // Unexpected Podfile shape — leave it untouched.
      }
      contents = contents.replace(anchor, (match) => `${match}\n${buildSnippet()}\n`);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);

module.exports = withIosDeploymentTarget;
