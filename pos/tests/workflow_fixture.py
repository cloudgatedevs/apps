"""Browser-test fixture: real POS scripts/SQLite, fake identity and Wallet.

Only binds loopback, requires a test header, never sends email/notifications or
contacts Cloudgate. The browser harness supplies a fresh temporary database.
"""
import argparse
import json
import re
import sqlite3
import sys
import textwrap
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'cloudgate'))
import refunds
WORKFLOWS = ROOT / 'cloudgate' / 'workflows'
HELPERS = (WORKFLOWS / '_shared' / 'lib.py').read_text(encoding='utf-8')
GRAPHS = {p.parent.name: json.loads(p.read_text(encoding='utf-8')) for p in WORKFLOWS.glob('*/workflow.json')}
WALLET = {}


def execute(db, sql):
    statement, result = '', []
    for character in sql:
        statement += character
        if character == ';' and sqlite3.complete_statement(statement):
            cursor = db.execute(statement)
            if cursor.description:
                result = [dict(row) for row in cursor.fetchall()]
            statement = ''
    if statement.strip():
        raise ValueError('Incomplete SQL in test fixture')
    return result


def workflow(db, route, body, role):
    if route == 'refunds':
        user = dict(Id=1 if role == 'Admin' else 2, Role=role, IsActive=True) if role else None
        loaded = execute(db, refunds.read_sql('pos', body, user))
        result = execute(db, refunds.claim_sql('pos', body, user, loaded))
        # Cash is completed by the real claim SQL/triggers; card refund settlement
        # is covered by cloudgate/test_refunds.py, not sent to an external provider.
        return json.loads(refunds.response(result, body.get('requestKey')))
    graph = GRAPHS[route]
    nodes = {node['name']: node for node in graph['nodes']}
    values = {'body': json.dumps(body), 'sessionid': '1'}
    current = graph['entry']
    for _ in range(50):
        node = nodes[current]
        kind = node['type']
        if kind == 'idp':
            if not role:
                raise ValueError('Sign in required.')
            if node.get('role') and role != node['role']:
                raise ValueError('Admin role required.')
            result = dict(Id=1 if role == 'Admin' else 2, Name='SDK', Surname='Cashier',
                          Email='cashier@example.invalid', Role=role, IsActive=True)
        elif kind in ('function', 'condition'):
            directory = WORKFLOWS / route
            libraries = '\n'.join((directory / name).read_text(encoding='utf-8') for name in node.get('libraries', []))
            # Substitute request values as data, never as executable Python source.
            source = HELPERS + '\n' + libraries + '\n'
            if node.get('libraries'):
                source += '\ndef payment_request_value(name):\n    return "http://127.0.0.1:3594" if name.lower() == "header_origin" else _values.get(name, "")\n'
            source += (directory / node['script']).read_text(encoding='utf-8')
            source = re.sub(r"('''|\"\"\")\$\{(\w+)\}\1", lambda m: '_values[' + repr(m[2]) + ']', source)
            scope = {'_values': values}
            exec('def run():\n' + textwrap.indent(source, '    '), scope)
            result = scope['run']()
        elif kind == 'database':
            sql = (WORKFLOWS / route / node['script']).read_text(encoding='utf-8')
            sql = re.sub(r'\$\{(\w+)\}', lambda m: values[m[1]], sql)
            result = execute(db, sql)
        elif kind == 'walletpayment':
            params = {key: re.sub(r'\$\{(\w+)\}', lambda m: values[m[1]], str(value)) for key, value in node['params'].items()}
            if params['operation'] == 'status':
                result = dict(IsReady=True, Provider='Test fixture', Status='Active', IsProduction=False)
            elif params['operation'] == 'create':
                payment_id = 1000 + len(WALLET)
                result = dict(Id=payment_id, GrossAmount=int(params['amount']), Currency=params['currency'],
                              PaymentUrl='https://checkout.example.invalid/' + str(payment_id), Status=0, IsProduction=False)
                WALLET[payment_id] = result
            elif params['operation'] == 'get':
                result = dict(WALLET[int(params['paymentId'])], Status=1)
            else:
                raise ValueError('Unsupported fake Wallet operation')
        else:
            raise ValueError('External service disabled in fixture: ' + kind)
        values[current] = result if isinstance(result, str) else json.dumps(result)
        current = node.get('positive' if result else 'negative') if kind == 'condition' else node.get('next')
        # Background email / websocket branches intentionally do not execute.
        if not current:
            return json.loads(result) if isinstance(result, str) else result
    raise ValueError('Workflow exceeded fixture node limit')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', required=True)
    parser.add_argument('--port', type=int, required=True)
    args = parser.parse_args()
    if Path(args.db).exists():
        parser.error('The fixture requires a new database')
    db = sqlite3.connect(args.db, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.executescript((ROOT / 'cloudgate' / 'schema.sql').read_text(encoding='utf-8'))
    db.executescript((ROOT / '.template' / 'sample-data.sql').read_text(encoding='utf-8'))

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_POST(self):
            status = 200
            try:
                if self.headers.get('X-POS-Test') != '1':
                    raise ValueError('Test header required')
                payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                result = workflow(db, self.path.removeprefix('/'), payload['body'], payload.get('role', ''))
            except Exception as error:
                if db.in_transaction:
                    db.rollback()
                status, result = 400, {'message': str(error)}
            data = json.dumps(result).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    class FixtureServer(HTTPServer):
        request_queue_size = 128  # Dashboard makes many parallel requests.

    FixtureServer(('127.0.0.1', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
