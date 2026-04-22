using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Dapper;
using GATI.API.Data;
using Microsoft.Extensions.Caching.Memory;

namespace GATI.API.Controllers;

[Route("api/v1/dashboard")]
[ApiController]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly IMemoryCache _cache;
    public const string CacheKey = "dashboard_stats";

    public DashboardController(IDbConnectionFactory db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        if (_cache.TryGetValue(CacheKey, out IActionResult? cached))
            return cached!;

        return await _cache.GetOrCreateAsync<IActionResult>(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            using var conn = _db.Create();

            var totalAtivos = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM equipamento");
            var totalMovimentacoes = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM movimentacao");
            var totalLocais = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM localizacao WHERE ativo = 1");
            var valorTotal = await conn.ExecuteScalarAsync<double?>("SELECT SUM(valor) FROM equipamento WHERE valor IS NOT NULL") ?? 0;

            var recentMovements = await conn.QueryAsync(
                @"SELECT TOP 10
                    m.id,
                    m.equipamento_id,
                    m.lote_id,
                    CASE WHEN m.termo_pdf_url IS NOT NULL AND m.lote_id IS NOT NULL THEN 1 ELSE 0 END AS has_termo,
                    CASE WHEN m.foto_assinatura_url IS NOT NULL AND m.lote_id IS NOT NULL THEN 1 ELSE 0 END AS has_foto,
                    ISNULL(NULLIF(f.sigla + ' - ', ' - '), '') + ISNULL(NULLIF(e.numero_patrimonio, ''), CAST(e.id AS VARCHAR)) AS patrimonio,
                    LTRIM(RTRIM(ISNULL(lo.bloco, '') + ' ' + ISNULL(lo.sala, ''))) AS origem,
                    LTRIM(RTRIM(ISNULL(lod.bloco, '') + ' ' + ISNULL(lod.sala, ''))) AS destino,
                    ISNULL(ut.nome, '--') AS tecnico,
                    ISNULL(ur.nome, '--') AS gestor,
                    CONVERT(varchar(23), m.data_movimentacao, 126) AS data_iso,
                    e.numero_patrimonio, e.marca, e.modelo, e.numero_serie, e.tipo, e.is_proprio, e.estado_conservacao, 
                    CASE WHEN e.ativo = 1 THEN 'ATIVO' ELSE 'INATIVO' END AS equipamento_status, 
                    f.sigla AS fornecedor_sigla, f.nome_empresa AS fornecedor_nome
                  FROM movimentacao m
                  JOIN equipamento e ON e.id = m.equipamento_id
                  LEFT JOIN fornecedor f ON e.fornecedor_id = f.id
                  LEFT JOIN localizacao lo  ON lo.id  = m.loc_origem_id
                  LEFT JOIN localizacao lod ON lod.id = m.loc_destino_id
                  LEFT JOIN usuario ut ON ut.id = m.tecnico_id
                  LEFT JOIN usuario ur ON ur.id = m.recebedor_id
                  ORDER BY m.data_movimentacao DESC");

            return Ok(new
            {
                total_ativos        = totalAtivos,
                total_movimentacoes = totalMovimentacoes,
                total_locais        = totalLocais,
                valor_total         = valorTotal,
                recent_movements    = recentMovements
            });
        }) ?? StatusCode(500);
    }
}
