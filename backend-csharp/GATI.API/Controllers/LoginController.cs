using Microsoft.AspNetCore.Mvc;
using Dapper;
using GATI.API.Data;
using GATI.API.DTOs;
using GATI.API.Models;
using GATI.API.Services;

namespace GATI.API.Controllers;

[Route("api/v1")]
[ApiController]
public class LoginController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly AuthService _authService;

    public LoginController(IDbConnectionFactory db, AuthService authService)
    {
        _db = db;
        _authService = authService;
    }

    [HttpPost("login/access-token/")]
    public ActionResult<LoginResponse> Login([FromForm] string? username, [FromForm] string? password)
    {
        try
        {
            if (string.IsNullOrEmpty(username))
                return BadRequest(new { detail = "Usuário é obrigatório" });

            if (string.IsNullOrEmpty(password))
                return BadRequest(new { detail = "Senha é obrigatória" });

            using var conn = _db.Create();
            var user = conn.QueryFirstOrDefault<Usuario>(
                "SELECT * FROM usuario WHERE matricula = ?", new { username });

            if (user == null || string.IsNullOrEmpty(user.SenhaHash) || !_authService.VerifyPassword(password, user.SenhaHash))
                return BadRequest(new { detail = "Usuário ou senha incorreta" });

            if (!user.Ativo)
                return BadRequest(new { detail = "Usuário inativo" });

            if (user.PerfilId != null)
                user.Perfil = conn.QueryFirstOrDefault<Perfil>(
                    "SELECT * FROM perfil WHERE id = ?", new { user.PerfilId });

            var token = _authService.GenerateToken(user);
            return Ok(new LoginResponse(token));
        }
        catch (Exception ex)
        {
            _ = ex;
            return StatusCode(500, new { detail = "Falha temporária ao conectar com o banco de dados. Contate o TI." });
        }
    }

    [HttpPost("verify-manager")]
    public async Task<ActionResult<VerifyManagerResponse>> VerifyManager([FromBody] VerifyManagerRequest req)
    {
        using var conn = _db.Create();
        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE matricula = ?", new { req.Matricula });

        var dummyHash = "$2b$12$KIXnRe3lKBMNbsPKKPpGpuCEjHOmWA0b5VqfRMVkGVZBNe9qzIkUO";
        bool passwordOk = _authService.VerifyPassword(req.Senha, user?.SenhaHash ?? dummyHash);

        if (user == null || !passwordOk)
            return BadRequest(new { detail = "Usuário ou senha incorreta" });

        return Ok(new VerifyManagerResponse(true, user.Id, user.Nome));
    }

    [HttpGet("test-token")]
    [HttpPost("test-token")]
    public async Task<ActionResult<UserResponse>> TestToken()
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var userId = int.Parse(userIdStr);
        using var conn = _db.Create();

        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { userId });

        if (user == null) return NotFound();

        return Ok(await BuildUserResponse(conn, user));
    }

    internal static async Task<UserResponse> BuildUserResponse(System.Data.IDbConnection conn, Usuario user)
    {
        PerfilInfo? perfilInfo = null;

        if (user.PerfilId != null)
        {
            var perfil = await conn.QueryFirstOrDefaultAsync<Perfil>(
                "SELECT * FROM perfil WHERE id = ?", new { user.PerfilId });

            if (perfil != null)
            {
                var permissoes = await conn.QueryAsync<PermissaoInfo>(
                    @"SELECT p.chave FROM permissao p
                      JOIN perfil_permissao pp ON pp.permissao_id = p.id
                      WHERE pp.perfil_id = ?", new { user.PerfilId });

                perfilInfo = new PerfilInfo(perfil.Nome, permissoes.ToList());
            }
        }

        return new UserResponse(user.Id, user.Nome, user.Matricula, user.Email,
            user.PerfilId, user.Ativo, user.AssinaturaUrl, perfilInfo);
    }
}
