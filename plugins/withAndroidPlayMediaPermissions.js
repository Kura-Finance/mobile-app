/**
 * Google Play Photo and Video Permissions policy (2024+):
 * apps with infrequent photo access must not declare READ_MEDIA_IMAGES / VIDEO.
 *
 * expo-screen-capture adds READ_MEDIA_IMAGES for optional screenshot *detection*
 * on API 33; we only use FLAG_SECURE (preventScreenCaptureAsync) and never
 * register screenshot listeners, so strip those merged permissions.
 *
 * Profile photos use the system photo picker (expo-image-picker) without broad
 * gallery access on Android 13+.
 */
const { AndroidConfig, createRunOncePlugin } = require('expo/config-plugins');

const PLAY_BLOCKED_MEDIA_PERMISSIONS = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

const withAndroidPlayMediaPermissions = (config) =>
  AndroidConfig.Permissions.withBlockedPermissions(config, PLAY_BLOCKED_MEDIA_PERMISSIONS);

module.exports = createRunOncePlugin(
  withAndroidPlayMediaPermissions,
  'withAndroidPlayMediaPermissions',
  '1.0.0',
);
