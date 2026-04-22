using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Security.Claims;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.DTOs;
using GATI.API.Middleware;

namespace GATI.API.Controllers;

[Route("api/v1/categorias")]
[ApiController]
public class CategoriasController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public CategoriasController(IDbConnectionFactory db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission("categorias:ler")]
    public async Task<ActionResult<IEnumerable<Categoria>>> GetCategorias()
    {
        using var conn = _db.Create();
        var result = await conn.QueryAsync<Categoria>("SELECT * FROM categoria ORDER BY nome");
        return Ok(result);
    }

    [HttpPost]
    [RequirePermission("categorias:criar")]
    public async Task<ActionResult<Categoria>> CreateCategoria(CategoriaCreate req)
    {
        using var conn = _db.Create();
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);
            var nomeUpper = req.Nome.ToUpper().Trim();

            var id = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO categoria (nome, campos_especificacoes, criado_por_id, criado_em) VALUES (?, ?, ?, ?);
                  SELECT CAST(SCOPE_IDENTITY() AS int)",
                new { nome = nomeUpper, campos_especificacoes = req.CamposEspecificacoes,
                      criadoPorId = userId, criadoEm = now });

            var nova = new Categoria { Id = id, Nome = nomeUpper, CamposEspecificacoes = req.CamposEspecificacoes };
            return CreatedAtAction(nameof(GetCategorias), new { id = nova.Id }, nova);
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("duplicate key") || ex.Message.Contains("UNIQUE constraint"))
        {
            return Conflict(new { detail = "Já existe uma categoria com este nome." });
        }
    }

    [HttpPut("{id}")]
    [RequirePermission("categorias:editar")]
    public async Task<IActionResult> UpdateCategoria(int id, CategoriaUpdate req)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Categoria>(
            "SELECT * FROM categoria WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Nome)) return BadRequest(new { detail = "O nome não pode ser vazio." });

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);
        var nomeUpper = req.Nome.ToUpper().Trim();

        try
        {
            await conn.ExecuteAsync(
                @"UPDATE categoria SET nome = ?, campos_especificacoes = ?,
                  modificado_por_id = ?, modificado_em = ? WHERE id = ?",
                new { nome = nomeUpper, campos_especificacoes = req.CamposEspecificacoes,
                      modificadoPorId = userId, modificadoEm = now, id });
            return NoContent();
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("duplicate key") || ex.Message.Contains("UNIQUE constraint"))
        {
            return Conflict(new { detail = "Já existe outra categoria com este nome." });
        }
    }

    [HttpDelete("{id}")]
    [RequirePermission("categorias:excluir")]
    public async Task<IActionResult> DeleteCategoria(int id)
    {
        using var conn = _db.Create();
        try
        {
            await conn.ExecuteAsync("DELETE FROM categoria WHERE id = ?", new { id });
            return NoContent();
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("REFERENCE constraint"))
        {
            // Nota: Categorias não possuem coluna 'ativo'. Se houver vínculo, apenas impedimos a exclusão.
            return BadRequest(new { 
                detail = "Esta categoria não pode ser excluída porque existem equipamentos vinculados a ela. Remova os vínculos primeiro." 
            });
        }
    }
}
