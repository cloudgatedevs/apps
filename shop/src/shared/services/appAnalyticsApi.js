import { auth } from './auth';
import { createAppAnalyticsClient } from './appAnalyticsClient';
import { createPublishedAnalyticsResolver } from './publishedAnalytics';

export const appAnalyticsApi = createAppAnalyticsClient({
  auth,
  apiUrl: import.meta.env.VITE_IDP_API_URL || import.meta.env.VITE_IDP_BASE_URL,
  projectPath: import.meta.env.VITE_CLOUDGATE_API_PROJECT,
  environment: import.meta.env.VITE_CLOUDGATE_API_ENV,
  preview: import.meta.env.MODE === 'preview',
  resolvePublishedApp: createPublishedAnalyticsResolver(),
});
