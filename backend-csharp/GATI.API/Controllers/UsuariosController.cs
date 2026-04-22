using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Security.Claims;
using GATI.API.Controllers;
using GATI.API.Data;
using GATI.API.DTOs;
using GATI.API.Models;
using GATI.API.Middleware;
using GATI.API.Services;

namespace GATI.API.Controllers;

[Route("api/v1/usuarios/")]
[ApiController]
public class UsuariosController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly AuthService _authService;
    private readonly AuditService _auditService;

    public UsuariosController(IDbConnectionFactory db, AuthService authService, AuditService auditService)
    {
        _db = db;
        _authService = authService;
        _auditService = auditService;
    }

    [HttpGet]
    [RequirePermission("usuarios:ler")]
    public async Task<ActionResult<IEnumerable<UserResponse>>> GetUsuarios(
        [FromQuery(Name = "perfil_id")] int? perfilId = null,
        [FromQuery(Name = "permissao_chave")] string? permissaoChave = null)
    {
        using var conn = _db.Create();
        var sql = "SELECT * FROM usuario u WHERE 1=1";
        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(permissaoChave))
        {
            sql += @" AND EXISTS (
                        SELECT 1 FROM perfil_permissao pp
                        INNER JOIN permissao p ON pp.permissao_id = p.id
                        WHERE pp.perfil_id = u.perfil_id
                        AND UPPER(p.chave) = UPPER(?)
                      )";
            parameters.Add("p1", permissaoChave.Trim());
        }

        if (perfilId.HasValue)
        {
            sql += " AND u.perfil_id = ?";
            parameters.Add("p2", perfilId.Value);
        }

        var users = (await conn.QueryAsync<Usuario>(sql, parameters)).ToList();
        var perfis = (await conn.QueryAsync<Perfil>("SELECT * FROM perfil")).ToDictionary(p => p.Id);

        return Ok(users.Select(u =>
        {
            PerfilInfo? perfilInfo = null;
            if (u.PerfilId.HasValue && perfis.TryGetValue(u.PerfilId.Value, out var p))
                perfilInfo = new PerfilInfo(p.Nome, new List<PermissaoInfo>());
            return new UserResponse(u.Id, u.Nome, u.Matricula, u.Email, u.PerfilId, u.Ativo, u.AssinaturaUrl, perfilInfo);
        }));
    }

    [HttpPost]
    [RequirePermission("usuarios:criar")]
    public async Task<ActionResult<UserResponse>> CreateUsuario(UsuarioCreate req)
    {
        using var conn = _db.Create();

        var existing = await conn.QueryFirstOrDefaultAsync<int?>(
            "SELECT id FROM usuario WHERE email = ?", new { req.Email });
        if (existing != null) return BadRequest(new { detail = "Este e-mail já está sendo utilizado por outro usuário." });

        var actorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        var senhaHash = _authService.HashPassword(req.Senha);
        var id = await conn.ExecuteScalarAsync<int>(
            @"INSERT INTO usuario (nome, matricula, email, senha_hash, perfil_id, ativo, criado_por_id, criado_em)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?);
              SELECT CAST(SCOPE_IDENTITY() AS int)",
            new { req.Nome, req.Matricula, req.Email, senhaHash, req.PerfilId, req.Ativo,
                  criadoPorId = actorId, criadoEm = now });

        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { id });

        await _auditService.RegistrarLog(actorId, "CRIAR", "usuario", id, null, SafeUser(user!),
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return CreatedAtAction(nameof(GetUsuarios), new { id },
            await LoginController.BuildUserResponse(conn, user!));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUsuario(int id, UsuarioUpdate req)
    {
        using var conn = _db.Create();
        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { id });
        if (user == null) return NotFound();

        var before = SafeUser(user);

        if (req.Nome != null) user.Nome = req.Nome;
        if (req.Matricula != null) user.Matricula = req.Matricula;
        if (req.Email != null)
        {
            var existing = await conn.QueryFirstOrDefaultAsync<int?>(
                "SELECT id FROM usuario WHERE email = ? AND id != ?", new { email = req.Email, id });
            if (existing != null) return BadRequest(new { detail = "Este e-mail já está sendo utilizado por outro usuário." });
            user.Email = req.Email;
        }
        if (req.PerfilId.HasValue) user.PerfilId = req.PerfilId;
        if (req.Ativo.HasValue) user.Ativo = req.Ativo.Value;
        if (req.AssinaturaUrl != null) user.AssinaturaUrl = req.AssinaturaUrl;

        if (!string.IsNullOrEmpty(req.Senha))
            user.SenhaHash = _authService.HashPassword(req.Senha);

        var actorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        if (conn is System.Data.Odbc.OdbcConnection odbcConn)
        {
            if (odbcConn.State != System.Data.ConnectionState.Open) odbcConn.Open();
            using var cmd = odbcConn.CreateCommand();
            cmd.CommandText = @"UPDATE usuario SET nome = ?, matricula = ?, email = ?,
                                  perfil_id = ?, ativo = ?, assinatura_url = ?, senha_hash = ?,
                                  modificado_por_id = ?, modificado_em = ? WHERE id = ?";
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p1", System.Data.Odbc.OdbcType.NVarChar)  { Value = user.Nome });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.VarChar)   { Value = user.Matricula });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p3", System.Data.Odbc.OdbcType.VarChar)   { Value = user.Email });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p4", System.Data.Odbc.OdbcType.Int)       { Value = user.PerfilId });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p5", System.Data.Odbc.OdbcType.Bit)       { Value = user.Ativo });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p6", System.Data.Odbc.OdbcType.NText)     { Value = (object?)user.AssinaturaUrl ?? DBNull.Value });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p7", System.Data.Odbc.OdbcType.VarChar)   { Value = user.SenhaHash });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p8", System.Data.Odbc.OdbcType.Int)       { Value = actorId });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p9", System.Data.Odbc.OdbcType.DateTime)  { Value = now });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p10", System.Data.Odbc.OdbcType.Int)      { Value = id });
            await cmd.ExecuteNonQueryAsync();
        }
        else
        {
            await conn.ExecuteAsync(
                @"UPDATE usuario SET nome = ?, matricula = ?, email = ?,
                  perfil_id = ?, ativo = ?, assinatura_url = ?, senha_hash = ?,
                  modificado_por_id = ?, modificado_em = ? WHERE id = ?",
                new { user.Nome, user.Matricula, user.Email, user.PerfilId, user.Ativo, user.AssinaturaUrl,
                      user.SenhaHash, modificadoPorId = actorId, modificadoEm = now, id });
        }

        await _auditService.RegistrarLog(actorId, "EDITAR", "usuario", id, before, SafeUser(user),
            HttpContext.Connection.RemoteIpAddress?.ToString());

        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> GetMe()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();

        var userId = int.Parse(userIdStr);
        using var conn = _db.Create();

        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { userId });

        if (user == null) return NotFound();

        return Ok(await LoginController.BuildUserResponse(conn, user));
    }

    [HttpPut("me/senha/")]
    public async Task<IActionResult> AlterarSenha([FromBody] AlterarSenhaRequest req)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        var userId = int.Parse(userIdStr);

        using var conn = _db.Create();
        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { userId });
        if (user == null) return NotFound();

        if (!_authService.VerifyPassword(req.senha_atual, user.SenhaHash))
            return BadRequest(new { detail = "Senha atual incorreta." });

        var novoHash = _authService.HashPassword(req.senha_nova);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        if (conn is System.Data.Odbc.OdbcConnection odbcConn)
        {
            if (odbcConn.State != System.Data.ConnectionState.Open) odbcConn.Open();
            using var cmd = odbcConn.CreateCommand();
            cmd.CommandText = "UPDATE usuario SET senha_hash = ?, modificado_por_id = ?, modificado_em = ? WHERE id = ?";
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p1", System.Data.Odbc.OdbcType.VarChar) { Value = novoHash });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.Int)     { Value = userId });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p3", System.Data.Odbc.OdbcType.DateTime){ Value = now });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p4", System.Data.Odbc.OdbcType.Int)     { Value = userId });
            await cmd.ExecuteNonQueryAsync();
        }
        else
        {
            await conn.ExecuteAsync(
                "UPDATE usuario SET senha_hash = ?, modificado_por_id = ?, modificado_em = ? WHERE id = ?",
                new { novoHash, modificadoPorId = userId, modificadoEm = now, userId });
        }

        return NoContent();
    }

    [HttpPost("me/assinatura/")]
    public async Task<IActionResult> SalvarAssinatura([FromBody] SalvarAssinaturaRequest req)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        var userId = int.Parse(userIdStr);

        var data = req.Base64;
        if (data.Contains(','))
            data = data.Split(',', 2)[1];

        byte[] imgBytes;
        try { imgBytes = Convert.FromBase64String(data); }
        catch { return BadRequest(new { detail = "Dados de imagem inválidos." }); }

        if (imgBytes.Length > 2 * 1024 * 1024)
            return StatusCode(413, new { detail = "Imagem muito grande. Máximo 2MB." });

        if (imgBytes.Length < 4 || imgBytes[0] != 0x89 || imgBytes[1] != 0x50 || imgBytes[2] != 0x4E || imgBytes[3] != 0x47)
            return BadRequest(new { detail = "Formato inválido. Apenas PNG é aceito." });

        var assinaturaDataUri = $"data:image/png;base64,{data}";

        using var conn = _db.Create();
        if (conn is System.Data.Odbc.OdbcConnection odbcConn)
        {
            try
            {
                if (odbcConn.State != System.Data.ConnectionState.Open) odbcConn.Open();
                using var cmd = odbcConn.CreateCommand();
                cmd.CommandText = "UPDATE usuario SET assinatura_url = ? WHERE id = ?";
                cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p1", System.Data.Odbc.OdbcType.NText) { Value = assinaturaDataUri });
                cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.Int)   { Value = userId });
                await cmd.ExecuteNonQueryAsync();
                return Ok(new { assinatura_url = assinaturaDataUri });
            }
            catch (Exception ex)
            {
                _ = ex;
                return StatusCode(500, new { detail = "Erro interno ao salvar assinatura no banco." });
            }
        }
        else
        {
            await conn.ExecuteAsync("UPDATE usuario SET assinatura_url = ? WHERE id = ?", new { assinaturaDataUri, userId });
            return Ok(new { assinatura_url = assinaturaDataUri });
        }
    }

    [HttpDelete("{id}")]
    [RequirePermission("usuarios:excluir")]
    public async Task<IActionResult> DeleteUsuario(int id)
    {
        using var conn = _db.Create();
        var cur = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { id });
        if (cur == null) return NotFound();

        var actorId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        try
        {
            await conn.ExecuteAsync("DELETE FROM usuario WHERE id = ?", new { id });
            await _auditService.RegistrarLog(actorId, "EXCLUIR", "usuario", id, SafeUser(cur), null, ip);
            return NoContent();
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("REFERENCE constraint"))
        {
            await conn.ExecuteAsync("UPDATE usuario SET ativo = 0 WHERE id = ?", new { id });
            var desativado = await conn.QueryFirstOrDefaultAsync<Usuario>(
                "SELECT * FROM usuario WHERE id = ?", new { id });
            await _auditService.RegistrarLog(actorId, "EXCLUIR", "usuario", id, SafeUser(cur), SafeUser(desativado!), ip);
            return Ok(new
            {
                softDelete = true,
                message = "Este usuário não pôde ser excluído permanentemente pois possui registros vinculados, por isso ele foi desativado automaticamente."
            });
        }
    }

    /// <summary>Retorna dados do usuário sem senha_hash para uso em logs de auditoria.</summary>
    private static object SafeUser(Usuario u) =>
        new { u.Id, u.Nome, u.Matricula, u.Email, u.PerfilId, u.Ativo };
}
