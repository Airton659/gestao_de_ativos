using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;
using Dapper;
using GATI.API.Data;

namespace GATI.API.Middleware;

public class RequirePermissionAttribute : TypeFilterAttribute
{
    public RequirePermissionAttribute(string permissionKey) : base(typeof(RequirePermissionFilter))
    {
        Arguments = new object[] { permissionKey };
    }
}

public class RequirePermissionFilter : IAsyncActionFilter
{
    private readonly string _permissionKey;
    private readonly IDbConnectionFactory _db;

    public RequirePermissionFilter(string permissionKey, IDbConnectionFactory db)
    {
        _permissionKey = permissionKey;
        _db = db;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var userIdStr = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        var userId = int.Parse(userIdStr);
        using var conn = _db.Create();

        var count = conn.ExecuteScalar<int>(
            @"SELECT COUNT(*)
              FROM usuario u
              JOIN perfil_permissao pp ON pp.perfil_id = u.perfil_id
              JOIN permissao p ON p.id = pp.permissao_id
              WHERE u.id = ? AND p.chave = ?",
            new { userId, chave = _permissionKey });

        if (count == 0)
        {
            context.Result = new ObjectResult(new { detail = $"Permissão negada. Necessária: {_permissionKey}" }) { StatusCode = 403 };
            return;
        }

        await next();
    }
}
