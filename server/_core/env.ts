export const ENV = {
  // ローカル開発モード: DEV_MODE=true で Manus OAuth / Forge API 不要
  devMode: process.env.DEV_MODE === "true",
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET || "dev-secret-key-change-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Google Business Profile API
  gbpClientId: process.env.GBP_CLIENT_ID ?? "",
  gbpClientSecret: process.env.GBP_CLIENT_SECRET ?? "",
  gbpRefreshToken: process.env.GBP_REFRESH_TOKEN ?? "",
  // Bunny Stream
  bunnyStreamApiKey: process.env.BUNNY_STREAM_API_KEY ?? "",
  bunnyStreamLibraryId: process.env.BUNNY_STREAM_LIBRARY_ID ?? "",
  bunnyTokenAuthKey: process.env.BUNNY_CDN_TOKEN_AUTH_KEY ?? "",
};
