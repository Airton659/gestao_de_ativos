using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Security.Claims;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.Middleware;
using GATI.API.Services;
using Microsoft.Extensions.Caching.Memory;

namespace GATI.API.Controllers;

[Route("api/v1/localizacoes")]
[ApiController]
public class LocalizacoesController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly AuditService _auditService;
    private readonly IMemoryCache _cache;
    private const string CacheKey = "localizacoes_list";

    public LocalizacoesController(IDbConnectionFactory db, AuditService auditService, IMemoryCache cache)
    {
        _db = db;
        _auditService = auditService;
        _cache = cache;
    }

    [HttpGet]
    [RequirePermission("localizacoes:ler")]
    public async Task<IActionResult> GetLocalizacoes()
    {
        using var conn = _db.Create();
        var localizacoes = await conn.QueryAsync<Localizacao>("SELECT * FROM localizacao");

        var result = localizacoes.OrderBy(l => l.Campus)
                                 .ThenBy(l => l.Bloco, new NaturalStringComparer())
                                 .ThenBy(l => l.Sala, new NaturalStringComparer());
        return Ok(result);
    }

    private class NaturalStringComparer : IComparer<string?>
    {
        public int Compare(string? x, string? y)
        {
            if (x == y) return 0;
            if (x == null) return -1;
            if (y == null) return 1;
            string Normalize(string s) =>
                System.Text.RegularExpressions.Regex.Replace(s, @"\d+", m => m.Value.PadLeft(12, '0'));
            return string.Compare(Normalize(x), Normalize(y), StringComparison.OrdinalIgnoreCase);
        }
    }

    [HttpPost]
    [RequirePermission("localizacoes:criar")]
    public async Task<ActionResult<Localizacao>> CreateLocalizacao(Localizacao l)
    {
        using var conn = _db.Create();
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        l.Id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO localizacao (campus, bloco, andar, sala, descricao, criado_por_id, criado_em, ativo)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1);
              SELECT CAST(SCOPE_IDENTITY() AS int)",
            new { l.Campus, l.Bloco, l.Andar, l.Sala, l.Descricao, criadoPorId = userId, criadoEm = now });

        var created = await conn.QueryFirstOrDefaultAsync<Localizacao>(
            "SELECT * FROM localizacao WHERE id = ?", new { l.Id });

        await _auditService.RegistrarLog(userId, "CRIAR", "localizacao", l.Id, null, created,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        _cache.Remove(CacheKey);
        return CreatedAtAction(nameof(GetLocalizacoes), new { id = l.Id }, l);
    }

    [HttpPut("{id}")]
    [RequirePermission("localizacoes:editar")]
    public async Task<IActionResult> UpdateLocalizacao(int id, Localizacao l)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Localizacao>(
            "SELECT * FROM localizacao WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        await conn.ExecuteAsync(
            @"UPDATE localizacao SET campus = ?, bloco = ?, andar = ?, sala = ?, descricao = ?, ativo = ?,
              modificado_por_id = ?, modificado_em = ? WHERE id = ?",
            new
            {
                campus          = string.IsNullOrEmpty(l.Campus) ? cur.Campus : l.Campus,
                bloco           = l.Bloco ?? cur.Bloco,
                andar           = l.Andar ?? cur.Andar,
                sala            = string.IsNullOrEmpty(l.Sala) ? cur.Sala : l.Sala,
                descricao       = l.Descricao ?? cur.Descricao,
                l.Ativo,
                modificadoPorId = userId,
                modificadoEm    = now,
                id
            });

        var updated = await conn.QueryFirstOrDefaultAsync<Localizacao>(
            "SELECT * FROM localizacao WHERE id = ?", new { id });

        await _auditService.RegistrarLog(userId, "EDITAR", "localizacao", id, cur, updated,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        _cache.Remove(CacheKey);
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("localizacoes:excluir")]
    public async Task<IActionResult> DeleteLocalizacao(int id)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Localizacao>(
            "SELECT * FROM localizacao WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        try
        {
            await conn.ExecuteAsync("DELETE FROM localizacao WHERE id = ?", new { id });
            await _auditService.RegistrarLog(userId, "EXCLUIR", "localizacao", id, cur, null, ip);
            _cache.Remove(CacheKey);
            return NoContent();
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("fk_movimentacao") || ex.Message.Contains("REFERENCE constraint"))
        {
            await conn.ExecuteAsync("UPDATE localizacao SET ativo = 0 WHERE id = ?", new { id });
            var desativado = await conn.QueryFirstOrDefaultAsync<Localizacao>(
                "SELECT * FROM localizacao WHERE id = ?", new { id });
            await _auditService.RegistrarLog(userId, "EXCLUIR", "localizacao", id, cur, desativado, ip);
            _cache.Remove(CacheKey);
            return Ok(new
            {
                softDelete = true,
                message = "Este local não pôde ser excluído permanentemente devido ao histórico de movimentações, por isso ele foi desativado automaticamente."
            });
        }
    }
}
