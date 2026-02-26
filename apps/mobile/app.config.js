/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  // Inject SENTRY_ORG / SENTRY_PROJECT from environment variables into the
  // @sentry/react-native plugin so sentry-cli can upload source maps during
  // EAS builds.  Set these as EAS secrets or in your local .env file.
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;

  const plugins = (config.plugins || []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    if (name !== "@sentry/react-native") return plugin;

    const existing = Array.isArray(plugin) ? plugin[1] : {};
    return [
      "@sentry/react-native",
      {
        ...existing,
        ...(sentryOrg && { organization: sentryOrg }),
        ...(sentryProject && { project: sentryProject }),
      },
    ];
  });

  return { ...config, plugins };
};
