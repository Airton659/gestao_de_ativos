using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Text.Json;
using GATI.API.Data;
using GATI.API.DTOs;
using GATI.API.Middleware;

namespace GATI.API.Controllers;

[Route("api/v1/auditoria")]
[ApiController]
public class AuditoriaController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public AuditoriaController(IDbConnectionFactory db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission("auditoria:ler")]
    public async Task<IActionResult> GetLogs(
        [FromQuery] int page = 1,
        [FromQuery] int page_size = 50,
        [FromQuery] string? entidade = null,
        [FromQuery] string? acao = null,
        [FromQuery] string? usuario = null,
        [FromQuery] string? de = null,
        [FromQuery] string? ate = null)
    {
        using var conn = _db.Create();

        var where = new List<string>();
        var dp = new DynamicParameters();
        int pIdx = 1;

        if (!string.IsNullOrWhiteSpace(entidade))
        {
            where.Add("a.entidade = ?");
            dp.Add("p" + (pIdx++), entidade.Trim());
        }
        if (!string.IsNullOrWhiteSpace(acao))
        {
            where.Add("a.acao = ?");
            dp.Add("p" + (pIdx++), acao.Trim().ToUpper());
        }
        if (!string.IsNullOrWhiteSpace(usuario))
        {
            where.Add("u.nome LIKE ?");
            dp.Add("p" + (pIdx++), $"%{usuario.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(de))
        {
            where.Add("a.created_at >= ?");
            dp.Add("p" + (pIdx++), de.Trim());
        }
        if (!string.IsNullOrWhiteSpace(ate))
        {
            where.Add("a.created_at <= ?");
            dp.Add("p" + (pIdx++), ate.Trim() + " 23:59:59");
        }

        var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        var skip = (page - 1) * page_size;

        const string FromJoin = @"FROM logauditoria a LEFT JOIN usuario u ON a.usuario_id = u.id";

        try
        {
            if (conn.State != System.Data.ConnectionState.Open)
                ((System.Data.Common.DbConnection)conn).Open();

            var total = await conn.ExecuteScalarAsync<int>($"SELECT COUNT(*) {FromJoin} {whereClause}", dp);

            var itemsSql = $@"
                SELECT * FROM (
                    SELECT a.id, a.usuario_id, u.nome AS usuario_nome,
                           a.acao, a.entidade, a.entidade_id,
                           a.dados_anteriores_json, a.dados_novos_json,
                           a.ip, a.created_at,
                           ROW_NUMBER() OVER (ORDER BY a.created_at DESC) AS row_num
                    {FromJoin}
                    {whereClause}
                ) AS t
                WHERE t.row_num > {skip} AND t.row_num <= {skip + page_size}
                ORDER BY t.row_num";

            var rows = await conn.QueryAsync<LogAuditoriaRow>(itemsSql, dp);

            var items = rows.Select(r => new LogAuditoriaResponse(
                r.Id,
                r.UsuarioId,
                r.UsuarioNome,
                r.Acao,
                r.Entidade,
                r.EntidadeId,
                TryParseJson(r.DadosAnterioresJson),
                TryParseJson(r.DadosNovosJson),
                r.Ip,
                r.CreatedAt
            )).ToList();

            return Ok(new { items, total, page, page_size });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = $"Erro ao buscar logs: {ex.Message}" });
        }
    }

    private static JsonElement? TryParseJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<JsonElement>(json); }
        catch { return null; }
    }
}
