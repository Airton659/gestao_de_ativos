using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Security.Claims;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.Middleware;
using GATI.API.Services;

namespace GATI.API.Controllers;

[Route("api/v1/fornecedores")]
[ApiController]
public class FornecedoresController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly AuditService _auditService;

    public FornecedoresController(IDbConnectionFactory db, AuditService auditService)
    {
        _db = db;
        _auditService = auditService;
    }

    [HttpGet]
    [RequirePermission("fornecedores:ler")]
    public async Task<ActionResult<IEnumerable<Fornecedor>>> GetFornecedores()
    {
        using var conn = _db.Create();
        var result = await conn.QueryAsync<Fornecedor>("SELECT * FROM fornecedor");
        return Ok(result);
    }

    [HttpPost]
    [RequirePermission("fornecedores:criar")]
    public async Task<ActionResult<Fornecedor>> CreateFornecedor(Fornecedor f)
    {
        using var conn = _db.Create();
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        f.Id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO fornecedor (nome_empresa, sigla, responsavel, telefone1, telefone2, cidade, cnpj,
              criado_por_id, criado_em, ativo)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
              SELECT CAST(SCOPE_IDENTITY() AS int)",
            new { f.NomeEmpresa, f.Sigla, f.Responsavel, f.Telefone1, f.Telefone2, f.Cidade, f.Cnpj,
                  criadoPorId = userId, criadoEm = now });

        var created = await conn.QueryFirstOrDefaultAsync<Fornecedor>(
            "SELECT * FROM fornecedor WHERE id = ?", new { f.Id });

        await _auditService.RegistrarLog(userId, "CRIAR", "fornecedor", f.Id, null, created,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return CreatedAtAction(nameof(GetFornecedores), new { id = f.Id }, f);
    }

    [HttpPut("{id}")]
    [RequirePermission("fornecedores:editar")]
    public async Task<IActionResult> UpdateFornecedor(int id, Fornecedor f)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Fornecedor>(
            "SELECT * FROM fornecedor WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        await conn.ExecuteAsync(
            @"UPDATE fornecedor SET nome_empresa = ?, sigla = ?, responsavel = ?,
              telefone1 = ?, telefone2 = ?, cidade = ?, cnpj = ?, ativo = ?,
              modificado_por_id = ?, modificado_em = ?
              WHERE id = ?",
            new
            {
                nomeEmpresa       = string.IsNullOrEmpty(f.NomeEmpresa) ? cur.NomeEmpresa : f.NomeEmpresa,
                sigla             = f.Sigla ?? cur.Sigla,
                responsavel       = string.IsNullOrEmpty(f.Responsavel) ? cur.Responsavel : f.Responsavel,
                telefone1         = string.IsNullOrEmpty(f.Telefone1) ? cur.Telefone1 : f.Telefone1,
                telefone2         = f.Telefone2 ?? cur.Telefone2,
                cidade            = string.IsNullOrEmpty(f.Cidade) ? cur.Cidade : f.Cidade,
                cnpj              = string.IsNullOrEmpty(f.Cnpj) ? cur.Cnpj : f.Cnpj,
                f.Ativo,
                modificadoPorId   = userId,
                modificadoEm      = now,
                id
            });

        var updated = await conn.QueryFirstOrDefaultAsync<Fornecedor>(
            "SELECT * FROM fornecedor WHERE id = ?", new { id });

        await _auditService.RegistrarLog(userId, "EDITAR", "fornecedor", id, cur, updated,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("fornecedores:excluir")]
    public async Task<IActionResult> DeleteFornecedor(int id)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Fornecedor>(
            "SELECT * FROM fornecedor WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        try
        {
            await conn.ExecuteAsync("DELETE FROM fornecedor WHERE id = ?", new { id });
            await _auditService.RegistrarLog(userId, "EXCLUIR", "fornecedor", id, cur, null, ip);
            return NoContent();
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("REFERENCE constraint"))
        {
            await conn.ExecuteAsync("UPDATE fornecedor SET ativo = 0 WHERE id = ?", new { id });
            var desativado = await conn.QueryFirstOrDefaultAsync<Fornecedor>(
                "SELECT * FROM fornecedor WHERE id = ?", new { id });
            await _auditService.RegistrarLog(userId, "EXCLUIR", "fornecedor", id, cur, desativado, ip);
            return Ok(new
            {
                softDelete = true,
                message = "Este fornecedor não pôde ser excluído permanentemente devido a equipamentos vinculados, por isso ele foi desativado automaticamente."
            });
        }
    }
}
