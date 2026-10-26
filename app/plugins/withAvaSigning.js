const { withAppBuildGradle } = require("expo/config-plugins");

// Signs release builds with the keystore described by AVA_UPLOAD_* properties in
// ~/.gradle/gradle.properties, so the setting survives `expo prebuild`.
module.exports = function withAvaSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let g = c.modResults.contents;
    if (g.includes("AVA_UPLOAD_STORE_FILE")) return c;

    g = g.replace(
      "            keyPassword 'android'\n        }\n    }",
      `            keyPassword 'android'
        }
        release {
            if (project.hasProperty('AVA_UPLOAD_STORE_FILE')) {
                storeFile file(AVA_UPLOAD_STORE_FILE)
                storePassword AVA_UPLOAD_STORE_PASSWORD
                keyAlias AVA_UPLOAD_KEY_ALIAS
                keyPassword AVA_UPLOAD_KEY_PASSWORD
            }
        }
    }`
    );
    g = g.replace(
      /            \/\/ Caution! In production[\s\S]*?signingConfig signingConfigs\.debug\n/,
      "            signingConfig project.hasProperty('AVA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug\n"
    );
    c.modResults.contents = g;
    return c;
  });
};
