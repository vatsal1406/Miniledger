const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable package export resolution for modern libraries like @tanstack/react-query
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
