# Cloudgate workflow sources

Version 3.0 uses Cloudgate-managed SQL Server databases and standard Python function nodes. See [the runtime contract](../../SQL-SERVER-REWRITE.md) for installation, SMTP selectors and test setup.

- schema.sql and sample-data.sql are native T-SQL. Sample records are sandbox-only.
- workflows/<route>/workflow.json defines the action and its node links.
- Python scripts validate requests and produce SQL plans; Database nodes execute the plans.
- IdP and Wallet nodes provide identity and payment operations.
- workflow_inputs.py packages ordinary workflow selectors as Python input data. It performs no service calls.
- smtp_email.py contains standard-library SMTP delivery. Credentials arrive through encrypted selectors.
- package_refunds.py rebuilds all local actions by default. Its historical filename is retained as a build entry point; it also accepts a list of route names.

Run npm run cloudgate:package to refresh the installation bundle offline. Run npm test and npm run test:ui to verify it against SQL Server. The deploy.py command publishes to the configured tenant; its database references must first be configured for newly provisioned SQL Server databases. Template FileId values are import mapping keys, not SQL Server connection strings.

A Database node exposes the first result set and executes the whole batch. Write operations precede the final result SELECT. Function nodes return Python values, and Condition nodes return booleans. Request and node-output selectors are bound as data by the existing runtime. No CLR or host-service imports are used.
