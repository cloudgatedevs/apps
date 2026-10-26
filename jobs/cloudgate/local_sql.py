"""SQL Server connection for loopback development only.
Set CLOUDGATE_LOCAL_SQLSERVER to an ODBC connection string for a dedicated app
development database. Hosted workflows use native Database nodes.
"""
import datetime,decimal,os,pyodbc
Error=pyodbc.Error
IntegrityError=pyodbc.Error
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
    def __init__(self):
        connection=os.environ.get('CLOUDGATE_LOCAL_SQLSERVER')
        if not connection:raise RuntimeError('Set CLOUDGATE_LOCAL_SQLSERVER to the connection string for this app development database.')
        self.raw=pyodbc.connect(connection,autocommit=True)
        self.raw.execute('SET NOCOUNT ON;SET XACT_ABORT ON;')
    def execute(self,sql,parameters=()):
        try:return Result(self.raw.cursor().execute(sql,parameters))
        except Exception:self.rollback();raise
    def executescript(self,sql):return self.execute(sql)
    def rollback(self):self.raw.execute('IF @@TRANCOUNT>0 ROLLBACK;')
    def commit(self):self.raw.execute('IF @@TRANCOUNT>0 COMMIT;')
    def close(self):
        if self.raw:self.raw.close();self.raw=None
    def __enter__(self):return self
    def __exit__(self,*args):self.close()
def connect():return Connection()
