using System.Data;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Moq;
using Xunit;
using GATI.API.Data;
using GATI.API.Middleware;

namespace GATI.Tests.Middleware;

/// <summary>
/// Testes do RequirePermissionFilter (RBAC):
///   - Sem claim de usuário → 401 Unauthorized
///   - Usuário sem a permissão → 403 Forbidden
///   - Usuário com a permissão → executa próximo filtro
/// </summary>
public class RequirePermissionFilterTests
{
    private const string Permissao = "equipamentos:ler";

    // ──────────────────────── Sem autenticação (sem claim) ────────────────────────

    [Fact]
    public async Task OnActionExecutionAsync_SemClaimDeUsuario_Retorna401()
    {
        var filter = CriarFiltro(contagemPermissoes: 0);
        var nextChamado = new[] { false };

        // Contexto com usuário anônimo (sem claims)
        var context = CriarContext(new ClaimsPrincipal(new ClaimsIdentity()));

        await filter.OnActionExecutionAsync(context, () =>
        {
            nextChamado[0] = true;
            return Task.FromResult(CriarExecutedContext(context));
        });

        context.Result.Should().BeOfType<UnauthorizedResult>();
        nextChamado[0].Should().BeFalse();
    }

    // ──────────────────────── Usuário sem permissão ────────────────────────

    [Fact]
    public async Task OnActionExecutionAsync_UsuarioSemPermissao_Retorna403()
    {
        // banco retorna count=0 → usuário não tem a permissão
        var filter = CriarFiltro(contagemPermissoes: 0);
        var nextChamado = new[] { false };

        var context = CriarContext(CriarPrincipal(userId: 99));

        await filter.OnActionExecutionAsync(context, () =>
        {
            nextChamado[0] = true;
            return Task.FromResult(CriarExecutedContext(context));
        });

        var resultado = context.Result.Should().BeOfType<ObjectResult>().Subject;
        resultado.StatusCode.Should().Be(403);
        nextChamado[0].Should().BeFalse();
    }

    [Fact]
    public async Task OnActionExecutionAsync_UsuarioSemPermissao_MensagemContemNomeDaPermissao()
    {
        var filter = CriarFiltro(contagemPermissoes: 0);
        var context = CriarContext(CriarPrincipal(userId: 1));

        await filter.OnActionExecutionAsync(context, () =>
            Task.FromResult(CriarExecutedContext(context)));

        var resultado = context.Result.Should().BeOfType<ObjectResult>().Subject;
        var detalhe = resultado.Value?.ToString();
        detalhe.Should().Contain(Permissao);
    }

    // ──────────────────────── Usuário com permissão ────────────────────────

    [Fact]
    public async Task OnActionExecutionAsync_UsuarioComPermissao_ChamaProximoFiltro()
    {
        // banco retorna count=1 → usuário tem a permissão
        var filter = CriarFiltro(contagemPermissoes: 1);
        var nextChamado = new[] { false };

        var context = CriarContext(CriarPrincipal(userId: 1));

        await filter.OnActionExecutionAsync(context, () =>
        {
            nextChamado[0] = true;
            return Task.FromResult(CriarExecutedContext(context));
        });

        nextChamado[0].Should().BeTrue();
        context.Result.Should().BeNull();
    }

    [Fact]
    public async Task OnActionExecutionAsync_UsuarioComPermissao_NaoRetornaResultado()
    {
        var filter = CriarFiltro(contagemPermissoes: 1);
        var context = CriarContext(CriarPrincipal(userId: 5));

        await filter.OnActionExecutionAsync(context, () =>
            Task.FromResult(CriarExecutedContext(context)));

        // Quando next é chamado, o Result não deve ser setado pelo filtro
        context.Result.Should().BeNull();
    }

    // ──────────────────────── Helpers ────────────────────────

    private static RequirePermissionFilter CriarFiltro(int contagemPermissoes)
    {
        var mockFactory = new Mock<IDbConnectionFactory>();
        var mockConn = new Mock<IDbConnection>();
        var mockCmd = new Mock<IDbCommand>();
        var mockParams = new Mock<IDataParameterCollection>();
        var mockParam = new Mock<IDbDataParameter>();

        mockParam.SetupAllProperties();
        mockCmd.SetupGet(c => c.Parameters).Returns(mockParams.Object);
        mockCmd.Setup(c => c.CreateParameter()).Returns(mockParam.Object);
        // Dapper usa ExecuteScalar para a query COUNT(*)
        mockCmd.Setup(c => c.ExecuteScalar()).Returns(contagemPermissoes);
        mockConn.SetupGet(c => c.State).Returns(ConnectionState.Open);
        mockConn.Setup(c => c.CreateCommand()).Returns(mockCmd.Object);
        mockFactory.Setup(f => f.Create()).Returns(mockConn.Object);

        return new RequirePermissionFilter(Permissao, mockFactory.Object);
    }

    private static ActionExecutingContext CriarContext(ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext { User = user };
        var controllerContext = new ControllerContext(
            new ActionContext(httpContext, new RouteData(), new ControllerActionDescriptor()));

        return new ActionExecutingContext(
            controllerContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            new object());
    }

    private static ActionExecutedContext CriarExecutedContext(ActionExecutingContext ctx)
    {
        var controllerContext = new ControllerContext(ctx);
        return new ActionExecutedContext(
            controllerContext,
            new List<IFilterMetadata>(),
            new object());
    }

    private static ClaimsPrincipal CriarPrincipal(int userId) =>
        new(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userId.ToString())],
            "Bearer"));
}
