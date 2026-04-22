using System.Text.Json;
using System.Text.Json.Nodes;
using Dapper;
using GATI.API.Data;
using GATI.API.Models;

namespace GATI.API.Services;

public class AuditService
{
    private readonly IDbConnectionFactory _db;

    public AuditService(IDbConnectionFactory db)
    {
        _db = db;
    }

    public Task RegistrarLog(
        int usuarioId,
        string acao,
        string entidade,
        int entidadeId,
        object? dadosAnteriores = null,
        object? dadosNovos = null,
        string? ip = null)
    {
        var antJson = SerializarParaAuditoria(dadosAnteriores);
        var novJson = SerializarParaAuditoria(dadosNovos);

        // Kind.Unspecified evita que o driver ODBC aplique conversão de timezone.
        var agora = DateTime.SpecifyKind(Movimentacao.BrasiliaNow(), DateTimeKind.Unspecified);

        using var conn = _db.Create();
        conn.Execute(
            @"INSERT INTO logauditoria
                (usuario_id, acao, entidade, entidade_id, dados_anteriores_json, dados_novos_json, ip, created_at)
              VALUES (?,?,?,?,?,?,?,?)",
            new { usuarioId, acao, entidade, entidadeId, antJson, novJson, ip, agora });
        return Task.CompletedTask;
    }

    /// <summary>
    /// Serializa o objeto para JSON removendo base64 de fotos (que pode ter MB)
    /// e substituindo pelo count, para não causar truncamento via ODBC.
    /// Marcado como internal para permitir testes unitários via InternalsVisibleTo.
    /// </summary>
    internal static string? SerializarParaAuditoria(object? obj)
    {
        if (obj == null) return null;

        var json = JsonSerializer.Serialize(obj);

        try
        {
            var node = JsonNode.Parse(json);
            if (node is JsonObject obj2)
            {
                // Substitui array de fotos pelo count — base64 pode ter MBs
                foreach (var key in new[] { "Fotos", "fotos" })
                {
                    if (obj2[key] is JsonArray arr)
                    {
                        obj2[key] = arr.Count;
                    }
                }
                return obj2.ToJsonString();
            }
        }
        catch { /* retorna json original se não conseguir parsear */ }

        return json;
    }
}
