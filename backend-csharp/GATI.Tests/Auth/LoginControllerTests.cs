using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.Services;
using GATI.Tests.Helpers;

namespace GATI.Tests.Auth;

/// <summary>
/// Testes de integração do LoginController usando WebApplicationFactory.
/// A fábrica de conexão é substituída por FakeDbConnection para não precisar de banco real.
/// </summary>
public class LoginControllerTests : IClassFixture<LoginControllerTests.GatiTestFactory>
{
    private readonly GatiTestFactory _factory;

    public LoginControllerTests(GatiTestFactory factory)
    {
        _factory = factory;
    }

    // ──────────────────────── Validação de entrada ────────────────────────

    [Fact]
    public async Task Login_SemUsername_RetornaBadRequest()
    {
        var client = _factory.CreateClientSemDb();
        var form = new FormUrlEncodedContent(
            [new("password", "qualquer")]);

        var response = await client.PostAsync("/api/v1/login/access-token/", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_SemSenha_RetornaBadRequest()
    {
        var client = _factory.CreateClientSemDb();
        var form = new FormUrlEncodedContent(
            [new("username", "admin")]);

        var response = await client.PostAsync("/api/v1/login/access-token/", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ──────────────────────── Usuário não encontrado ────────────────────────

    [Fact]
    public async Task Login_UsuarioInexistente_RetornaBadRequest()
    {
        var client = _factory.CreateClientComUsuario(usuario: null);

        var form = new FormUrlEncodedContent(
        [
            new("username", "inexistente"),
            new("password", "qualquer")
        ]);

        var response = await client.PostAsync("/api/v1/login/access-token/", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        body!["detail"].Should().Contain("Usuário ou senha incorreta");
    }

    // ──────────────────────── Usuário inativo ────────────────────────

    [Fact]
    public async Task Login_UsuarioInativo_RetornaBadRequest()
    {
        var authService = CriarAuthService();
        var usuario = CriarUsuario(ativo: false, senhaHash: authService.HashPassword("senha123"));

        var client = _factory.CreateClientComUsuario(usuario);

        var form = new FormUrlEncodedContent(
        [
            new("username", usuario.Matricula),
            new("password", "senha123")
        ]);

        var response = await client.PostAsync("/api/v1/login/access-token/", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        body!["detail"].Should().Contain("inativo");
    }

    // ──────────────────────── Senha errada ────────────────────────

    [Fact]
    public async Task Login_SenhaErrada_RetornaBadRequest()
    {
        var authService = CriarAuthService();
        var usuario = CriarUsuario(ativo: true, senhaHash: authService.HashPassword("senha_correta"));

        var client = _factory.CreateClientComUsuario(usuario);

        var form = new FormUrlEncodedContent(
        [
            new("username", usuario.Matricula),
            new("password", "senha_errada")
        ]);

        var response = await client.PostAsync("/api/v1/login/access-token/", form);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ──────────────────────── Login com sucesso ────────────────────────

    [Fact]
    public async Task Login_CredenciaisValidas_RetornaTokenJwt()
    {
        var authService = CriarAuthService();
        var usuario = CriarUsuario(ativo: true, senhaHash: authService.HashPassword("senha123"));

        var client = _factory.CreateClientComUsuario(usuario);

        var form = new FormUrlEncodedContent(
        [
            new("username", usuario.Matricula),
            new("password", "senha123")
        ]);

        var response = await client.PostAsync("/api/v1/login/access-token/", form);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        body!.Should().ContainKey("access_token");
        body["access_token"].Should().NotBeNullOrEmpty();
    }

    // ──────────────────────── Helpers ────────────────────────

    private static AuthService CriarAuthService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"] = GatiTestFactory.TestSecretKey,
                ["Jwt:ExpireMinutes"] = "60"
            })
            .Build();
        return new AuthService(config);
    }

    private static Usuario CriarUsuario(bool ativo, string senhaHash) => new()
    {
        Id = 1,
        Nome = "Usuário Teste",
        Matricula = "TI001",
        Email = "teste@example.com",
        SenhaHash = senhaHash,
        Ativo = ativo,
        PerfilId = 1,
        Perfil = new Perfil { Id = 1, Nome = "TI" }
    };

    // ──────────────────────── WebApplicationFactory ────────────────────────

    public class GatiTestFactory : WebApplicationFactory<Program>
    {
        public const string TestSecretKey = "chave-secreta-de-testes-com-minimo-32-caracteres!";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration(config =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:SecretKey"] = TestSecretKey,
                    ["Jwt:ExpireMinutes"] = "60",
                    ["ConnectionStrings:DefaultConnection"] = "Driver={SQL Server};Server=test;"
                });
            });
        }

        /// <summary>Cria HttpClient sem dados de DB — útil para testar validação de campos.</summary>
        public HttpClient CreateClientSemDb()
        {
            return WithWebHostBuilder(b => b.ConfigureServices(services =>
            {
                SubstituirDb(services, usuario: null, perfil: null);
            })).CreateClient();
        }

        /// <summary>Cria HttpClient com mock de DB que simula retorno de um usuário específico.</summary>
        public HttpClient CreateClientComUsuario(Usuario? usuario)
        {
            return WithWebHostBuilder(b => b.ConfigureServices(services =>
            {
                SubstituirDb(services, usuario, usuario?.Perfil);
            })).CreateClient();
        }

        private static void SubstituirDb(
            IServiceCollection services,
            Usuario? usuario,
            Perfil? perfil)
        {
            var descriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(DbConnectionFactory));
            if (descriptor != null) services.Remove(descriptor);

            var iDescriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(IDbConnectionFactory));
            if (iDescriptor != null) services.Remove(iDescriptor);

            // FakeDbConnection herda de DbConnection (exigido pelo Dapper)
            var fakeConn = new FakeDbConnection();
            fakeConn.AddReader(CriarUsuarioReader(usuario));
            if (perfil != null)
                fakeConn.AddReader(CriarPerfilReader(perfil));

            var mockFactory = new Mock<IDbConnectionFactory>();
            mockFactory.Setup(f => f.Create()).Returns(fakeConn);

            services.AddSingleton(mockFactory.Object);
            services.AddSingleton<IDbConnectionFactory>(mockFactory.Object);
            services.AddSingleton<DbConnectionFactory>(_ =>
                throw new InvalidOperationException("Use IDbConnectionFactory nos testes"));
        }

        // ── Schemas dos readers ──

        private static readonly string[] UsuarioNames =
        [
            "id", "nome", "matricula", "email", "senha_hash", "perfil_id",
            "ativo", "assinatura_url", "criado_por_id", "criado_em",
            "modificado_por_id", "modificado_em"
        ];

        private static readonly Type[] UsuarioTypes =
        [
            typeof(int), typeof(string), typeof(string), typeof(string), typeof(string),
            typeof(int), typeof(bool), typeof(string), typeof(int), typeof(DateTime),
            typeof(int), typeof(DateTime)
        ];

        private static readonly string[] PerfilNames =
            ["id", "nome", "descricao", "criado_em", "modificado_em"];

        private static readonly Type[] PerfilTypes =
            [typeof(int), typeof(string), typeof(string), typeof(DateTime), typeof(DateTime)];

        private static FakeDbDataReader CriarUsuarioReader(Usuario? u)
        {
            if (u == null)
                return new FakeDbDataReader(UsuarioNames, UsuarioTypes, []);

            return new FakeDbDataReader(UsuarioNames, UsuarioTypes,
            [
                [
                    (object)u.Id,
                    u.Nome,
                    u.Matricula,
                    u.Email,
                    u.SenhaHash,
                    (object?)u.PerfilId,
                    (object)u.Ativo,
                    u.AssinaturaUrl,
                    null, // criado_por_id
                    null, // criado_em
                    null, // modificado_por_id
                    null  // modificado_em
                ]
            ]);
        }

        private static FakeDbDataReader CriarPerfilReader(Perfil p)
        {
            return new FakeDbDataReader(PerfilNames, PerfilTypes,
            [
                [
                    (object)p.Id,
                    p.Nome,
                    p.Descricao,
                    null, // criado_em
                    null  // modificado_em
                ]
            ]);
        }
    }
}
