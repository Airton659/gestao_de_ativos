using Microsoft.AspNetCore.Mvc;
using Dapper;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.Middleware;

namespace GATI.API.Controllers;

[Route("api/v1/permissoes")]
[ApiController]
public class PermissoesController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public PermissoesController(IDbConnectionFactory db)
    {
        _db = db;
    }

    [HttpGet]
    [RequirePermission("permissoes:ler")]
    public async Task<ActionResult<IEnumerable<Permissao>>> GetPermissoes()
    {
        using var conn = _db.Create();
        var result = await conn.QueryAsync<Permissao>("SELECT * FROM permissao");
        return Ok(result);
    }

    [HttpPost("sync")]
    [RequirePermission("perfis:editar")]
    public async Task<IActionResult> SyncPermissoes()
    {
        var expected = new (string chave, string nome)[]
        {
            ("equipamentos:ler", "Ler Ativos"), ("equipamentos:criar", "Criar Ativos"), ("equipamentos:editar", "Editar Ativos"), ("equipamentos:excluir", "Excluir Ativos"),
            ("movimentacoes:ler", "Ler Movimentações"), ("movimentacoes:criar", "Criar Movimentações"), ("movimentacoes:assinar", "Assinar Movimentações"), ("movimentacoes:trocar-responsabilidade", "Trocar Responsabilidade"),
            ("localizacoes:ler", "Ler Localizações"), ("localizacoes:criar", "Criar Localizações"), ("localizacoes:editar", "Editar Localizações"), ("localizacoes:excluir", "Excluir Localizações"),
            ("fornecedores:ler", "Ler Fornecedores"), ("fornecedores:criar", "Criar Fornecedores"), ("fornecedores:editar", "Editar Fornecedores"), ("fornecedores:excluir", "Excluir Fornecedores"),
            ("usuarios:ler", "Ler Usuários"), ("usuarios:criar", "Criar Usuários"), ("usuarios:editar", "Editar Usuários"), ("usuarios:excluir", "Excluir Usuários"),
            ("perfis:ler", "Ler Perfis"), ("perfis:criar", "Criar Perfis"), ("perfis:editar", "Editar Perfis"), ("perfis:excluir", "Excluir Perfis"),
            ("permissoes:ler", "Ler Permissões"), ("permissoes:editar", "Editar Permissões"),
            ("relatorios:gerar", "Gerar Relatórios"),
            ("auditoria:ler", "Ler Auditoria"),
            ("categorias:ler", "Ler Categorias"), ("categorias:criar", "Criar Categorias"), ("categorias:editar", "Editar Categorias"), ("categorias:excluir", "Excluir Categorias")
        };

        using var conn = _db.Create();
        
        // Remover permissões que NÃO deveriam existir (ex: movimentações:excluir)
        await conn.ExecuteAsync("DELETE FROM permissao WHERE chave = 'movimentacoes:excluir'");

        var existing = (await conn.QueryAsync<string>("SELECT chave FROM permissao")).ToHashSet();
        
        int added = 0;
        foreach (var p in expected)
        {
            if (!existing.Contains(p.chave))
            {
                await conn.ExecuteAsync("INSERT INTO permissao (chave, nome) VALUES (?, ?)", new { p.chave, p.nome });
                added++;
            }
        }

        return Ok(new { added, total = expected.Length });
    }
}
