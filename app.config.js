const brand = require('./app.config.branding');

module.exports = {
  expo: {
    name: brand.appName,
    slug: brand.slug,
    version: "0.2.10",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    plugins: [
      "expo-secure-store",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
            deploymentTarget: "15.1",
          },
        },
      ],
      [
        "expo-image-picker",
        {
          microphonePermission: false,
        },
      ],
      "expo-apple-authentication",
      "./plugins/withAndroidPlayMediaPermissions",
      "./plugins/withIosDeploymentTarget",
      "./plugins/withIosSceneLifecycle",
      "./plugins/withIosDisableScriptSandbox",
    ],
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      bundleIdentifier: brand.bundleId,
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocalNetworkUsageDescription: "This app needs access to your local network to connect to financial services",
        NSBonjourServiceTypes: ["_http._tcp", "_https._tcp"],
        NSFaceIDUsageDescription: `${brand.appName} uses Face ID to unlock the app after it has been in the background.`,
        NSCameraUsageDescription:
          `${brand.appName} uses the camera to scan QR codes when sending crypto or connecting to dApps. When you choose, it is also used to take a profile photo or capture images during identity verification with our partners.`,
        NSMicrophoneUsageDescription: "Microphone access is required to record video for liveness verification during identity checks.",
        NSPhotoLibraryUsageDescription: "Photo library access is required to upload document images for identity verification or select a profile picture.",
        NSLocationWhenInUseUsageDescription: "Location access is used to detect your country for identity verification.",
        LSApplicationQueriesSchemes: [
          "metamask",
          "trust",
          "safe",
          "rainbow",
          "uniswap",
          "oneinch",
          "ledger",
          "coinbase",
          "walletconnect"
        ]
      },
      scheme: brand.scheme,
      associatedDomains: [
        `webcredentials:${brand.webCredentialsHost}`,
        `applinks:${brand.universalLinkHost}`,
      ],
    },
    android: {
      package: brand.bundleId,
      permissions: [
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundImage: "./assets/android-background.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      scheme: brand.scheme,
      intentFilters: [
        {
          action: "android.intent.action.VIEW",
          autoVerify: true,
          data: {
            scheme: "https",
            host: `*.${brand.universalLinkHost}`
          },
          category: [
            "android.intent.category.DEFAULT",
            "android.intent.category.BROWSABLE"
          ]
        },
        {
          action: "android.intent.action.VIEW",
          data: {
            scheme: brand.scheme
          },
          category: [
            "android.intent.category.DEFAULT",
            "android.intent.category.BROWSABLE"
          ]
        }
      ]
    },
    web: {
      favicon: "./assets/icon.png",
    },
    extra: {
      walletConnectProjectId:
        process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ||
        process.env.WALLETCONNECT_PROJECT_ID ||
        "development_project_id",
      backendUrl:
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        "",
      backendUrlDev:
        process.env.EXPO_PUBLIC_BACKEND_URL_DEV ||
        undefined,
      environment: process.env.APP_ENV || process.env.NODE_ENV || "development",
      privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID || "",
      privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || "",
      logodevToken: process.env.EXPO_PUBLIC_LOGODEV_TOKEN || "",
      pimlicoApiKey: process.env.EXPO_PUBLIC_PIMLICO_API_KEY || "",
      alchemyApiKey: process.env.EXPO_PUBLIC_ALCHEMY_API_KEY || "",
      kuraEarnFeeRecipient: process.env.EXPO_PUBLIC_KURA_EARN_FEE_RECIPIENT || "",
      morphoEarnFee: process.env.EXPO_PUBLIC_MORPHO_EARN_FEE || "0.1",
      lifiIntegrator: process.env.EXPO_PUBLIC_LIFI_INTEGRATOR || "",
      lifiFee: process.env.EXPO_PUBLIC_LIFI_FEE || "",
      lifiApiKey: process.env.EXPO_PUBLIC_LIFI_API_KEY || "",
    },
  },
};
