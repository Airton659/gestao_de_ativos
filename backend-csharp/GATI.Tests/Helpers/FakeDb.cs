using System.Collections;
using System.Data;
using System.Data.Common;

namespace GATI.Tests.Helpers;

/// <summary>
/// DbConnection fake que herda de DbConnection (exigido pelo Dapper para operações sync/async).
/// Acumula readers e scalars que são devolvidos em ordem de enfileiramento.
/// </summary>
internal sealed class FakeDbConnection : DbConnection
{
    private readonly Queue<DbDataReader> _readers = new();
    private readonly Queue<object?> _scalars = new();

    public void AddReader(FakeDbDataReader reader) => _readers.Enqueue(reader);
    public void AddScalar(object? value) => _scalars.Enqueue(value);

    public override string ConnectionString { get; set; } = "";
    public override string Database => "";
    public override string DataSource => "";
    public override string ServerVersion => "";
    public override ConnectionState State => ConnectionState.Open;

    public override void Open() { }
    public override void Close() { }
    public override void ChangeDatabase(string databaseName) { }

    protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel)
        => throw new NotSupportedException();

    protected override DbCommand CreateDbCommand()
        => new FakeDbCommand(_readers, _scalars);
}

internal sealed class FakeDbCommand : DbCommand
{
    private readonly Queue<DbDataReader> _readers;
    private readonly Queue<object?> _scalars;
    private readonly FakeDbParameterCollection _params = new();

    public FakeDbCommand(Queue<DbDataReader> readers, Queue<object?> scalars)
    {
        _readers = readers;
        _scalars = scalars;
    }

    public override string CommandText { get; set; } = "";
    public override int CommandTimeout { get; set; }
    public override CommandType CommandType { get; set; }
    public override bool DesignTimeVisible { get; set; }
    public override UpdateRowSource UpdatedRowSource { get; set; }
    protected override DbConnection? DbConnection { get; set; }
    protected override DbParameterCollection DbParameterCollection => _params;
    protected override DbTransaction? DbTransaction { get; set; }

    public override void Cancel() { }
    public override void Prepare() { }
    public override int ExecuteNonQuery() => 1;

    public override object? ExecuteScalar()
        => _scalars.Count > 0 ? _scalars.Dequeue() : 0;

    public override Task<object?> ExecuteScalarAsync(CancellationToken cancellationToken)
        => Task.FromResult(ExecuteScalar());

    protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior)
        => _readers.Count > 0 ? _readers.Dequeue() : new FakeDbDataReader([], [], []);

    protected override Task<DbDataReader> ExecuteDbDataReaderAsync(
        CommandBehavior behavior, CancellationToken cancellationToken)
        => Task.FromResult<DbDataReader>(ExecuteDbDataReader(behavior));

    protected override DbParameter CreateDbParameter() => new FakeDbParameter();
}

internal sealed class FakeDbParameter : DbParameter
{
    public override DbType DbType { get; set; }
    public override ParameterDirection Direction { get; set; }
    public override bool IsNullable { get; set; }
    public override string ParameterName { get; set; } = "";
    public override string SourceColumn { get; set; } = "";
    public override object? Value { get; set; }
    public override bool SourceColumnNullMapping { get; set; }
    public override int Size { get; set; }
    public override void ResetDbType() { }
}

internal sealed class FakeDbParameterCollection : DbParameterCollection
{
    private readonly List<DbParameter> _list = new();

    public override int Count => _list.Count;
    public override object SyncRoot => _list;

    public override int Add(object value) { _list.Add((DbParameter)value); return _list.Count - 1; }
    public override void AddRange(Array values) { foreach (var v in values) Add(v); }
    public override void Clear() => _list.Clear();
    public override bool Contains(object value) => _list.Contains((DbParameter)value);
    public override bool Contains(string value) => _list.Any(p => p.ParameterName == value);
    public override void CopyTo(Array array, int index) => ((ICollection)_list).CopyTo(array, index);
    public override IEnumerator GetEnumerator() => _list.GetEnumerator();
    public override int IndexOf(object value) => _list.IndexOf((DbParameter)value);
    public override int IndexOf(string parameterName) => _list.FindIndex(p => p.ParameterName == parameterName);
    public override void Insert(int index, object value) => _list.Insert(index, (DbParameter)value);
    public override void Remove(object value) => _list.Remove((DbParameter)value);
    public override void RemoveAt(int index) => _list.RemoveAt(index);
    public override void RemoveAt(string parameterName) => _list.RemoveAt(IndexOf(parameterName));
    protected override DbParameter GetParameter(int index) => _list[index];
    protected override DbParameter GetParameter(string parameterName) => _list.First(p => p.ParameterName == parameterName);
    protected override void SetParameter(int index, DbParameter value) => _list[index] = value;
    protected override void SetParameter(string parameterName, DbParameter value) => _list[IndexOf(parameterName)] = value;
}

/// <summary>
/// DbDataReader com esquema explícito (nomes + tipos) e linhas de valores.
/// GetFieldType sempre retorna o tipo declarado, mesmo para colunas com null,
/// o que é exigido pelo gerador de IL do Dapper.
/// </summary>
internal sealed class FakeDbDataReader : DbDataReader
{
    private readonly string[] _names;
    private readonly Type[] _types;
    private readonly object?[][] _rows;
    private int _rowIndex = -1;
    private bool _closed;

    public FakeDbDataReader(string[] names, Type[] types, object?[][] rows)
    {
        _names = names;
        _types = types;
        _rows = rows;
    }

    public override int FieldCount => _names.Length;
    public override bool HasRows => _rows.Length > 0;
    public override bool IsClosed => _closed;
    public override int RecordsAffected => 0;
    public override int Depth => 0;

    public override bool Read()
    {
        if (_closed) return false;
        _rowIndex++;
        return _rowIndex < _rows.Length;
    }

    public override bool NextResult() => false;
    public override void Close() => _closed = true;

    public override string GetName(int ordinal) => _names[ordinal];
    public override int GetOrdinal(string name) => Array.IndexOf(_names, name);
    public override Type GetFieldType(int ordinal) => _types[ordinal];
    public override string GetDataTypeName(int ordinal) => _types[ordinal].Name;

    public override object GetValue(int ordinal)
        => _rows[_rowIndex][ordinal] ?? DBNull.Value;

    public override bool IsDBNull(int ordinal)
        => _rows[_rowIndex][ordinal] == null;

    public override int GetValues(object[] values)
    {
        var count = Math.Min(values.Length, _names.Length);
        for (int i = 0; i < count; i++) values[i] = GetValue(i);
        return count;
    }

    public override object this[int ordinal] => GetValue(ordinal);
    public override object this[string name] => GetValue(GetOrdinal(name));

    public override bool GetBoolean(int ordinal) => Convert.ToBoolean(_rows[_rowIndex][ordinal]);
    public override byte GetByte(int ordinal) => Convert.ToByte(_rows[_rowIndex][ordinal]);
    public override long GetBytes(int ordinal, long dataOffset, byte[]? buffer, int bufferOffset, int length) => 0;
    public override char GetChar(int ordinal) => Convert.ToChar(_rows[_rowIndex][ordinal]);
    public override long GetChars(int ordinal, long dataOffset, char[]? buffer, int bufferOffset, int length) => 0;
    public override DateTime GetDateTime(int ordinal) => Convert.ToDateTime(_rows[_rowIndex][ordinal]);
    public override decimal GetDecimal(int ordinal) => Convert.ToDecimal(_rows[_rowIndex][ordinal]);
    public override double GetDouble(int ordinal) => Convert.ToDouble(_rows[_rowIndex][ordinal]);
    public override float GetFloat(int ordinal) => Convert.ToSingle(_rows[_rowIndex][ordinal]);
    public override Guid GetGuid(int ordinal) => (Guid)_rows[_rowIndex][ordinal]!;
    public override short GetInt16(int ordinal) => Convert.ToInt16(_rows[_rowIndex][ordinal]);
    public override int GetInt32(int ordinal) => Convert.ToInt32(_rows[_rowIndex][ordinal]);
    public override long GetInt64(int ordinal) => Convert.ToInt64(_rows[_rowIndex][ordinal]);
    public override string GetString(int ordinal) => Convert.ToString(_rows[_rowIndex][ordinal])!;

    public override IEnumerator GetEnumerator() => throw new NotSupportedException();
    public override DataTable? GetSchemaTable() => null;
}
