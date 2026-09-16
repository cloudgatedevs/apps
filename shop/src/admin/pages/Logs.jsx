// Workflow logs for this shop, read from Cloudgate's log store and scoped to the shop's own
// controller + environment. The page itself is the shared component (same file in every App
// Store app); this wrapper only gives it a route and a title.
import { CloudgateWorkflowLogs } from '@/shared/CloudgateWorkflowLogs';

const Logs = () => <CloudgateWorkflowLogs title="Logs" titleClassName="hidden lg:block" />;

export { Logs };
