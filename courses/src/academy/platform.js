import { createCloudgatePlatform, createCloudgateClient } from '@cloudgatedevs/cloudgate-client-react';
import { configurePreview } from './preview-platform';
import { protectAcademyMedia } from './media-guard';
export const preview = import.meta.env.DEV && import.meta.env.MODE === 'preview';
const config = {
  idpBaseUrl: import.meta.env.VITE_IDP_BASE_URL, apiUrl: import.meta.env.VITE_IDP_API_URL,
  tenancyName: import.meta.env.VITE_IDP_TENANCY_NAME, webAppId: import.meta.env.VITE_CLOUDGATE_WEB_APP_ID,
  environment: import.meta.env.VITE_CLOUDGATE_API_ENV || 'sbx',
  projectPath: import.meta.env.VITE_CLOUDGATE_API_PROJECT || 'courses',
  gatewayUrl: import.meta.env.VITE_CLOUDGATE_API_URL, mediaFolder: 'courses',
};
export const cloudgate = createCloudgatePlatform(preview ? configurePreview(config) : config);
if (preview) cloudgate.login = () => location.assign('/?signIn=1');
export const workflow = !preview && config.gatewayUrl ? createCloudgateClient({
  baseUrl: config.gatewayUrl, environment: config.environment, basePath: config.projectPath,
  apiKey: import.meta.env.VITE_API_KEY, apiSecret: import.meta.env.VITE_API_SECRET,
  headers: () => cloudgate.auth.authHeader(), timeoutMs: 20000,
}) : null;
protectAcademyMedia(cloudgate, async () => {
  const { call } = await import('./api');
  return call('workspace');
});
