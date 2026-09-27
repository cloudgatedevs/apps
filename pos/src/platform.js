import { createCloudgatePlatform } from '@cloudgatedevs/cloudgate-client-react';
import { protectPosMedia } from './shared/services/media-guard';

export const cloudgate = createCloudgatePlatform({
  idpBaseUrl: import.meta.env.VITE_IDP_BASE_URL, apiUrl: import.meta.env.VITE_IDP_API_URL,
  tenancyName: import.meta.env.VITE_IDP_TENANCY_NAME, webAppId: import.meta.env.VITE_CLOUDGATE_WEB_APP_ID,
  environment: import.meta.env.VITE_CLOUDGATE_API_ENV || 'sbx',
  projectPath: import.meta.env.VITE_CLOUDGATE_API_PROJECT || 'pos',
  gatewayUrl: import.meta.env.VITE_CLOUDGATE_API_URL, mediaFolder: 'pos',
});
protectPosMedia(cloudgate, async () => {
  const { adminApi } = await import('./admin/services/adminApi');
  return adminApi.products.imageRefs();
});
