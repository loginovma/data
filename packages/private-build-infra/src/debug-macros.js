'use strict';

module.exports = function debugMacros(app, isProd) {
  const PACKAGES = require('./packages')(app);
  const FEATURES = require('./features')(isProd);
  const debugMacrosPath = require.resolve('babel-plugin-debug-macros');
  let plugins = [
    [
      debugMacrosPath,
      {
        flags: [
          {
            source: '@ember-data/canary-features',
            flags: FEATURES,
          },
        ],
      },
      '@ember-data/canary-features-stripping',
    ],
    [
      debugMacrosPath,
      {
        flags: [
          {
            source: '@ember-data/private-build-infra',
            flags: PACKAGES,
          },
        ],
      },
      '@ember-data/optional-packages-stripping',
    ],
  ];

  return plugins;
};