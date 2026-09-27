import { useSettings } from '@cloudgatedevs/cloudgate-client-react/react';
// Translate SDK appearance for the public site and customer pages.
export function useBranding() {
  const { settings } = useSettings();
  return { app_name: settings.app_name, app_short_name: settings.app_name,
    logo_url: settings.app_logo_url, icon_url: settings.app_icon_url,
    favicon_url: settings.app_icon_url, logo_show_name: '1' };
}
