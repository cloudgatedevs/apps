import { CloudgateAppAnalytics } from '@/shared/CloudgateAppAnalytics';
import '@/shared/cloudgate-app-analytics-theme.css';

export function Analytics() {
  return <div className="space-y-5">
    <header><h1 className="hidden text-xl font-semibold text-mist lg:block">Analytics</h1><p className="mt-1 text-sm text-mist-dim">Understand your website traffic.</p></header>
    <CloudgateAppAnalytics />
  </div>;
}
