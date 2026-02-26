module.exports = {
  dependencies: {
    "@nozbe/simdjson": {
      platforms: {
        ios: null, // Disable iOS auto-linking; the WatermelonDB Expo plugin adds this pod itself.
      },
    },
  },
};
