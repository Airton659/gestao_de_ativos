using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Security.Claims;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.Middleware;
using GATI.API.DTOs;
using GATI.API.Services;

namespace GATI.API.Controllers;

[Route("api/v1/perfis")]
[ApiController]
public class PerfisController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly AuditService _auditService;

    public PerfisController(IDbConnectionFactory db, AuditService auditService)
    {
        _db = db;
        _auditService = auditService;
    }

    [HttpGet]
    [RequirePermission("perfis:ler")]
    public async Task<ActionResult<IEnumerable<Perfil>>> GetPerfis()
    {
        using var conn = _db.Create();
        var perfis = (await conn.QueryAsync<Perfil>("SELECT * FROM perfil")).ToList();

        foreach (var perfil in perfis)
        {
            perfil.Permissoes = (await conn.QueryAsync<Permissao>(
                @"SELECT p.* FROM permissao p
                  JOIN perfil_permissao pp ON pp.permissao_id = p.id
                  WHERE pp.perfil_id = ?",
                new { perfil.Id })).ToList();
        }

        return Ok(perfis);
    }

    [HttpPost]
    [RequirePermission("perfis:criar")]
    public async Task<ActionResult<Perfil>> CreatePerfil(PerfilRequest req)
    {
        using var conn = _db.Create();
        conn.Open();
        using var trans = conn.BeginTransaction();
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

            var id = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO perfil (nome, descricao, criado_por_id, criado_em) VALUES (?, ?, ?, ?);
                  SELECT CAST(SCOPE_IDENTITY() AS int)",
                new { req.Nome, req.Descricao, criadoPorId = userId, criadoEm = now }, trans);

            if (req.PermissoesIds != null && req.PermissoesIds.Any())
            {
                foreach (var permId in req.PermissoesIds)
                {
                    await conn.ExecuteAsync(
                        "INSERT INTO perfil_permissao (perfil_id, permissao_id) VALUES (?, ?)",
                        new { perfil_id = id, permissao_id = permId }, trans);
                }
            }

            trans.Commit();

            var perfil = await conn.QueryFirstOrDefaultAsync<Perfil>(
                "SELECT * FROM perfil WHERE id = ?", new { id });

            await _auditService.RegistrarLog(userId, "CRIAR", "perfil", id, null,
                new { perfil!.Id, perfil.Nome, perfil.Descricao, PermissoesIds = req.PermissoesIds },
                HttpContext.Connection.RemoteIpAddress?.ToString());

            return CreatedAtAction(nameof(GetPerfis), new { id }, perfil);
        }
        catch
        {
            trans.Rollback();
            throw;
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePerfil(int id, PerfilRequest req)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        bool canEditPerfil = await HasPermission(userId, "perfis:editar");
        bool canEditPermissoes = await HasPermission(userId, "permissoes:editar");

        if (!canEditPerfil && !canEditPermissoes)
            return StatusCode(403, new { detail = "Acesso negado. Requer 'perfis:editar' ou 'permissoes:editar'." });

        using var conn = _db.Create();

        // Captura estado anterior (antes de abrir a transação)
        var perfilAtual = await conn.QueryFirstOrDefaultAsync<Perfil>(
            "SELECT * FROM perfil WHERE id = ?", new { id });
        if (perfilAtual == null) return NotFound();

        var permissoesAtuais = (await conn.QueryAsync<int>(
            "SELECT permissao_id FROM perfil_permissao WHERE perfil_id = ?", new { id })).ToList();

        var before = new { perfilAtual.Id, perfilAtual.Nome, perfilAtual.Descricao, PermissoesIds = permissoesAtuais };

        conn.Open();
        using var trans = conn.BeginTransaction();
        try
        {
            var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

            if (canEditPerfil)
            {
                await conn.ExecuteAsync(
                    "UPDATE perfil SET nome = ?, descricao = ?, modificado_por_id = ?, modificado_em = ? WHERE id = ?",
                    new { req.Nome, req.Descricao, modificadoPorId = userId, modificadoEm = now, id }, trans);
            }

            if (canEditPermissoes)
            {
                await conn.ExecuteAsync("DELETE FROM perfil_permissao WHERE perfil_id = ?", new { id }, trans);

                if (req.PermissoesIds != null && req.PermissoesIds.Any())
                {
                    foreach (var permId in req.PermissoesIds)
                    {
                        await conn.ExecuteAsync(
                            "INSERT INTO perfil_permissao (perfil_id, permissao_id) VALUES (?, ?)",
                            new { perfil_id = id, permissao_id = permId }, trans);
                    }
                }
            }

            trans.Commit();

            var after = new { id, req.Nome, req.Descricao, PermissoesIds = req.PermissoesIds ?? permissoesAtuais };
            await _auditService.RegistrarLog(userId, "EDITAR", "perfil", id, before, after,
                HttpContext.Connection.RemoteIpAddress?.ToString());

            return NoContent();
        }
        catch
        {
            trans.Rollback();
            throw;
        }
    }

    [HttpDelete("{id}")]
    [RequirePermission("perfis:excluir")]
    public async Task<IActionResult> DeletePerfil(int id)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Perfil>(
            "SELECT * FROM perfil WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        var permissoes = (await conn.QueryAsync<int>(
            "SELECT permissao_id FROM perfil_permissao WHERE perfil_id = ?", new { id })).ToList();

        await conn.ExecuteAsync("DELETE FROM perfil_permissao WHERE perfil_id = ?", new { id });
        await conn.ExecuteAsync("DELETE FROM perfil WHERE id = ?", new { id });

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _auditService.RegistrarLog(userId, "EXCLUIR", "perfil", id,
            new { cur.Id, cur.Nome, cur.Descricao, PermissoesIds = permissoes }, null,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return NoContent();
    }

    private async Task<bool> HasPermission(int userId, string key)
    {
        using var conn = _db.Create();
        var count = await conn.ExecuteScalarAsync<int>(
            @"SELECT COUNT(*) FROM usuario u
              JOIN perfil_permissao pp ON pp.perfil_id = u.perfil_id
              JOIN permissao p ON p.id = pp.permissao_id
              WHERE u.id = ? AND p.chave = ?",
            new { userId, key });
        return count > 0;
    }
}
