using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Xunit;
using GATI.API.Models;
using GATI.API.Services;

namespace GATI.Tests.Auth;

/// <summary>
/// Testes unitários do AuthService: hash de senha, verificação e geração de JWT.
/// Nomenclatura: Metodo_Cenario_ResultadoEsperado
/// </summary>
public class AuthServiceTests
{
    private readonly AuthService _sut;
    private const string SecretKey = "chave-secreta-de-testes-com-minimo-32-caracteres!";

    public AuthServiceTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:SecretKey"] = SecretKey,
                ["Jwt:ExpireMinutes"] = "240"
            })
            .Build();

        _sut = new AuthService(config);
    }

    // ──────────────────────── HashPassword ────────────────────────

    [Fact]
    public void HashPassword_SenhaValida_RetornaHashNaoVazio()
    {
        var hash = _sut.HashPassword("MinhaSenh@123");

        hash.Should().NotBeNullOrEmpty();
        hash.Should().NotBe("MinhaSenh@123"); // não deve ser texto plano
    }

    [Fact]
    public void HashPassword_MesmaSenha_RetornaHashesDiferentes()
    {
        // BCrypt gera salt aleatório; dois hashes da mesma senha devem ser distintos
        var hash1 = _sut.HashPassword("senha");
        var hash2 = _sut.HashPassword("senha");

        hash1.Should().NotBe(hash2);
    }

    // ──────────────────────── VerifyPassword ────────────────────────

    [Fact]
    public void VerifyPassword_SenhaCorreta_RetornaTrue()
    {
        var hash = _sut.HashPassword("MinhaSenh@123");

        _sut.VerifyPassword("MinhaSenh@123", hash).Should().BeTrue();
    }

    [Fact]
    public void VerifyPassword_SenhaErrada_RetornaFalse()
    {
        var hash = _sut.HashPassword("SenhaCorreta");

        _sut.VerifyPassword("SenhaErrada", hash).Should().BeFalse();
    }

    [Fact]
    public void VerifyPassword_SenhaVazia_RetornaFalse()
    {
        var hash = _sut.HashPassword("SenhaCorreta");

        _sut.VerifyPassword("", hash).Should().BeFalse();
    }

    // ──────────────────────── GenerateToken ────────────────────────

    [Fact]
    public void GenerateToken_UsuarioValido_RetornaTokenNaoVazio()
    {
        var token = _sut.GenerateToken(CriarUsuarioTeste());

        token.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void GenerateToken_UsuarioValido_TokenContemClaimNameIdentifier()
    {
        var user = CriarUsuarioTeste();

        var token = _sut.GenerateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        var claim = jwt.Claims.FirstOrDefault(c =>
            c.Type == "nameid" || c.Type == ClaimTypes.NameIdentifier);

        claim.Should().NotBeNull();
        claim!.Value.Should().Be(user.Id.ToString());
    }

    [Fact]
    public void GenerateToken_UsuarioValido_TokenContemClaimMatricula()
    {
        var user = CriarUsuarioTeste();

        var token = _sut.GenerateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        var claim = jwt.Claims.FirstOrDefault(c =>
            c.Type == "unique_name" || c.Type == ClaimTypes.Name);

        claim.Should().NotBeNull();
        claim!.Value.Should().Be(user.Matricula);
    }

    [Fact]
    public void GenerateToken_UsuarioValido_TokenContemClaimRole()
    {
        var user = CriarUsuarioTeste();

        var token = _sut.GenerateToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        var claim = jwt.Claims.FirstOrDefault(c =>
            c.Type == "role" || c.Type == ClaimTypes.Role);

        claim.Should().NotBeNull();
        claim!.Value.Should().Be(user.Perfil!.Nome);
    }

    [Fact]
    public void GenerateToken_UsuarioValido_TokenPossuiExpiracao()
    {
        var token = _sut.GenerateToken(CriarUsuarioTeste());

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        jwt.ValidTo.Should().BeAfter(DateTime.UtcNow);
        jwt.ValidTo.Should().BeBefore(DateTime.UtcNow.AddHours(5)); // margem de 240 min + folga
    }

    [Fact]
    public void GenerateToken_SemChaveSecreta_LancaInvalidOperationException()
    {
        var configSemChave = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();
        var serviceSemChave = new AuthService(configSemChave);

        var act = () => serviceSemChave.GenerateToken(CriarUsuarioTeste());

        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*Jwt:SecretKey*");
    }

    // ──────────────────────── Helpers ────────────────────────

    private static Usuario CriarUsuarioTeste() => new()
    {
        Id = 42,
        Nome = "João Silva",
        Matricula = "TI001",
        Email = "joao@example.com",
        SenhaHash = "$2b$12$dummy",
        PerfilId = 1,
        Ativo = true,
        Perfil = new Perfil { Id = 1, Nome = "TI" }
    };
}
