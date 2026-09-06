#!/usr/bin/env python3
"""Run a SQL file against the shop database through the Cloudgate workflow MCP.

    python cloudgate/apply_sql.py cloudgate/schema.sql                 # sandbox db: creates what is missing, seeds once
    python cloudgate/apply_sql.py cloudgate/schema.sql --prod --skip-sample   # production db, without the sample catalogue

Statements are sent one at a time (split on a semicolon at the end of a line) so a single failure
names the statement. The database file id comes from deploy.config.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deploy import Mcp  # noqa: E402

ROOT = os.path.dirname(os.path.abspath(__file__))


def statements(sql):
    out, buf = [], []
    for line in sql.splitlines():
        stripped = line.strip()
        if not buf and (not stripped or stripped.startswith('--')):
            continue
        buf.append(line)
        if stripped.endswith(';'):
            out.append('\n'.join(buf).strip())
            buf = []
    if buf and ''.join(buf).strip():
        out.append('\n'.join(buf).strip())
    return out


def main(argv):
    files = [a for a in argv if not a.startswith('--')]
    path = files[0] if files else os.path.join(ROOT, 'schema.sql')
    config = json.load(open(os.path.join(ROOT, 'deploy.config.json'), encoding='utf-8'))
    db = config['databases']['default']
    prod = '--prod' in argv
    file_id = db.get('fileProdId') if prod else db['fileId']
    if not file_id:
        raise SystemExit('deploy.config.json has no fileProdId; create the production database first')
    mcp = Mcp.from_env()
    sql = open(path, encoding='utf-8').read()
    if '--skip-sample' in argv:
        # Drop the block between the @sample-catalog markers (dev-only demo products).
        start, end = sql.find('-- @sample-catalog:start'), sql.find('-- @sample-catalog:end')
        if start >= 0 and end > start:
            sql = sql[:start] + sql[end:]
    stmts = statements(sql)
    print(f"Applying {len(stmts)} statements from {os.path.basename(path)} to {'PRODUCTION' if prod else 'sandbox'} database {file_id}")
    failed = 0
    for i, stmt in enumerate(stmts, 1):
        head = stmt.splitlines()[0][:90]
        try:
            res = mcp.call('execute_database_sql', {'file_id': file_id, 'sql': stmt, 'dry_run': False})
            err = res.get('error') if isinstance(res, dict) else None
            if err:
                raise RuntimeError(err)
            print(f"  ok   {i:3d}  {head}")
        except Exception as ex:  # noqa: BLE001
            if 'duplicate column name' in str(ex).lower():
                print(f"  skip {i:3d}  {head}  (column exists)")
                continue
            failed += 1
            print(f"  FAIL {i:3d}  {head}\n         {str(ex)[:300]}")
    print(f"done: {len(stmts) - failed} ok, {failed} failed")
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
