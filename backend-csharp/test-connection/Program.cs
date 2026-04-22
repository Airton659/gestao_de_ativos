using System.Data.Odbc;

var connStr = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING")
    ?? throw new InvalidOperationException("Set the DB_CONNECTION_STRING environment variable before running this tool.");

Console.WriteLine("Testando FreeTDS via ODBC...");
Console.WriteLine($"odbcinst.ini:");
Console.WriteLine(File.Exists("/etc/odbcinst.ini") ? File.ReadAllText("/etc/odbcinst.ini") : "(não encontrado)");

try
{
    using var conn = new OdbcConnection(connStr);
    await conn.OpenAsync();
    Console.WriteLine("✓ Conexão aberta com sucesso!");

    using var cmd = conn.CreateCommand();
    cmd.CommandText = "SELECT @@VERSION";
    var version = await cmd.ExecuteScalarAsync();
    Console.WriteLine($"✓ SQL Server version: {version}");
}
catch (Exception ex)
{
    Console.WriteLine($"✗ ERRO: {ex.Message}");
    if (ex.InnerException != null)
        Console.WriteLine($"  Inner: {ex.InnerException.Message}");
    Environment.Exit(1);
}
