"""SQL Server integration fixtures. Every connection owns a disposable schema.

Set CLOUDGATE_TEST_SQLSERVER to an ODBC connection string for a dedicated test
database. The default uses local Windows authentication and CloudgateAppsTests.
Production workflows use Cloudgate Database nodes, never this driver.
"""
import datetime
import decimal
import os
import uuid
import pyodbc
import atexit

_connections = set()
@atexit.register
def _cleanup():
    for connection in list(_connections):
        connection.close()

Error = pyodbc.Error
IntegrityError = pyodbc.Error
OperationalError = pyodbc.Error

class Row(dict):
    def __getitem__(self, key):
        return list(self.values())[key] if isinstance(key, int) else super().__getitem__(key)

def _value(value):
    if isinstance(value, datetime.datetime): return value.isoformat().rstrip('0').rstrip('.') if value.microsecond else value.isoformat()
    if isinstance(value, decimal.Decimal): return float(value)
    return value

class Result:
    def __init__(self, cursor):
        self.rowcount = cursor.rowcount
        self.description = None
        self.rows = []
        # Database nodes expose the first result set and execute the entire batch.
        while True:
            if cursor.description and self.description is None:
                self.description = cursor.description
                names=[column[0] for column in cursor.description]
                self.rows=[Row(zip(names, map(_value,row))) for row in cursor.fetchall()]
            if not cursor.nextset(): break
        cursor.close()
    def fetchone(self): return self.rows.pop(0) if self.rows else None
    def fetchall(self): rows,self.rows=self.rows,[];return rows
    def __iter__(self): return iter(self.rows)

class Connection:
    def __init__(self, schema=None):
        connection=os.environ.get('CLOUDGATE_TEST_SQLSERVER')
        if not connection:
            base='DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost;Trusted_Connection=yes;TrustServerCertificate=yes;'
            with pyodbc.connect(base+'DATABASE=master;',autocommit=True) as admin:
                admin.execute("IF DB_ID(N'CloudgateAppsTests') IS NULL CREATE DATABASE [CloudgateAppsTests];")
            connection=base+'DATABASE=CloudgateAppsTests;'
        self.raw=pyodbc.connect(connection,autocommit=True)
        _connections.add(self)
        self.schema=schema or 'cgtest_'+uuid.uuid4().hex
        self.owns_schema=schema is None
        if schema is not None:
            import re
            if not re.fullmatch('cgtest_[0-9a-f]{32}',schema):raise ValueError('Invalid test schema')
            self.raw.execute("EXECUTE AS USER=N'"+self.schema+"';SET NOCOUNT ON;SET XACT_ABORT ON;")
            return
        self.raw.execute('CREATE SCHEMA ['+self.schema+'];')
        self.raw.execute('CREATE USER ['+self.schema+'] WITHOUT LOGIN WITH DEFAULT_SCHEMA=['+self.schema+'];')
        self.raw.execute('ALTER AUTHORIZATION ON SCHEMA::['+self.schema+'] TO ['+self.schema+'];')
        self.raw.execute('GRANT CREATE TABLE TO ['+self.schema+'];')
        self.raw.execute('GRANT CONTROL ON SCHEMA::['+self.schema+'] TO ['+self.schema+'];')
        self.raw.execute("EXECUTE AS USER=N'"+self.schema+"'; SET NOCOUNT ON; SET XACT_ABORT ON;")
    def execute(self, sql, parameters=()):
        try: return Result(self.raw.cursor().execute(sql, parameters))
        except Exception:
            self.rollback()
            raise
    def executescript(self, sql): return self.execute(sql)
    def executemany(self, sql, parameters):
        for row in parameters:self.execute(sql,row)
    def commit(self): self.raw.execute('IF @@TRANCOUNT>0 COMMIT TRANSACTION;')
    def rollback(self): self.raw.execute('IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;')
    @property
    def in_transaction(self):return self.raw.execute('SELECT @@TRANCOUNT').fetchone()[0]>0
    def close(self):
        if self.raw is None:return
        try:
            self.rollback();self.raw.execute('REVERT;')
            if not self.owns_schema:return
            # Only objects belonging to this invocation's random schema are removed.
            for table,constraint in self.raw.execute('SELECT OBJECT_NAME(parent_object_id),name FROM sys.foreign_keys WHERE schema_id=SCHEMA_ID(?)',self.schema).fetchall():
                self.raw.execute('ALTER TABLE ['+self.schema+'].['+table.replace(']',']]')+'] DROP CONSTRAINT ['+constraint.replace(']',']]')+'];')
            for (table,) in self.raw.execute('SELECT name FROM sys.tables WHERE schema_id=SCHEMA_ID(?)',self.schema).fetchall():
                self.raw.execute('DROP TABLE ['+self.schema+'].['+table.replace(']',']]')+'];')
            self.raw.execute('DROP SCHEMA ['+self.schema+']; DROP USER ['+self.schema+'];')
        finally:self.raw.close();self.raw=None;_connections.discard(self)
    def __enter__(self):return self
    def __exit__(self,*unused):self.close()

def connect(schema=None, **kwargs): return Connection(schema)
