# Marketplace 3.0

All six applications use Cloudgate-managed Microsoft SQL Server databases and standard Python workflows. This is a fresh-install release. It does not migrate data or preserve compatibility with the previous SQLite applications.

| App | Business data and workflows |
| --- | --- |
| Shop | Catalogue, variants, carts, stock reservations, checkout, orders and durable refunds |
| POS | Registers, shifts, cash/card sales, stock, receipts and durable refunds |
| Booking | Services, availability, appointment allocations, payment holds and reminders |
| Jobs | Requests, quotes, visits, invoices, attachments and recurring work |
| Academy | Courses, lessons, assessments, enrolments and certificates |
| Events | Events, ticket orders, admissions and organiser reporting |

The React apps call workflow actions through the existing SDK. IdP nodes establish identity; Python validates requests and prepares business operations; Database nodes execute native T-SQL; Wallet nodes perform payment operations. Python processes the results and returns the response.

## Runtime contract

- SQL Server **2022 or later** is required for the native JSON and scalar functions used here.
- Each bundle declares two managed SQL Server databases: Type 3, SelfHosted false. Cloudgate creates them using its existing database provisioning support. Sandbox and production have distinct references.
- The installer applies the full schema as a batch. Sample data belongs only in sandbox. Production starts with configuration and required system records.
- Python uses the standard library. There are no CLR, Python.NET, host-service imports or Cloudgate bridge calls.
- Ordinary workflow selectors supply request and prior-node values. The existing Python runtime binds selectors as data; app code must not paste untrusted text into executable source.
- SQL literals encode Unicode as UTF-16LE hex and convert it to nvarchar. SQL identifiers come from fixed application code.
- Revision updates and refund claims use transactions and SQL Server locking. Repeated provider confirmations do not apply money or stock twice.

Keep Database and Wallet operations in their native workflow nodes. A Python function must not open an application database connection or resolve a platform service.

## Workflow email

Email uses Python's smtplib, ssl and email modules. Configure the following encrypted controller selectors separately for sandbox and production:

| Selector | Value |
| --- | --- |
| SMTP_HOST | SMTP server hostname |
| SMTP_PORT | 587 for STARTTLS, or 465 for implicit TLS |
| SMTP_SECURITY | starttls or ssl |
| SMTP_USERNAME | SMTP account, if authentication is required |
| SMTP_PASSWORD | SMTP password |
| SMTP_FROM_EMAIL | Verified sending address |
| SMTP_FROM_NAME | Display name |

The bundle creates selector definitions with blank credentials. Set them before enabling delivery workers or testing receipts. These workflow selectors are separate from the SDK's tenant SMTP administration. Credentials never belong in Vite variables or public app settings. Delivery failures retain the outbox's retry behavior and do not expose provider details.

## Local development and verification

Use Python 3.13, Node.js, Microsoft ODBC Driver 17 or 18 and a reachable SQL Server 2022 instance.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-test.txt
python test_support/run.py -m unittest discover -s tests
npm --prefix shop test
npm --prefix shop run test:ui
```

Repeat the npm commands for pos, booking, jobs, courses and events. Browser tests require Playwright Chromium. All payment and SMTP transports in the automated tests are mocked.

By default, SQL integration tests use Windows authentication on localhost and create CloudgateAppsTests, with an isolated schema per test. To use another dedicated test database, set CLOUDGATE_TEST_SQLSERVER to its ODBC connection string. The test login must be able to create users, schemas and tables. Use a dedicated test database.

For a persistent local preview of Booking, Jobs, Academy or Events, create a dedicated development database and set CLOUDGATE_LOCAL_SQLSERVER to its ODBC connection string. Then run npm run dev:api and npm run dev:preview in the app folder. The --data-dir option controls local media files; it is not a database path.

Run npm run cloudgate:package in each app after changing its workflow sources or schema. This rebuilds the checked-in installation bundle offline. Packaging and automated tests do not publish workflows or deploy an app. Hosted sandbox installation, configured SMTP delivery and provider payment settlement still need environment verification before production release.
