// Workflow logs for this till and back office, read from Cloudgate's log store and scoped to the
// POS controller + environment. The page itself is the shared component (same file in every App
// Store app); this wrapper only gives it a route and a title.
import { CloudgateWorkflowLogs } from '@/shared/CloudgateWorkflowLogs';

const Logs = () => <CloudgateWorkflowLogs title="Logs" />;

export { Logs };
