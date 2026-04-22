using System.Data;
using System.Text.Json;
using FluentAssertions;
using Moq;
using Xunit;
using GATI.API.Data;
using GATI.API.Services;

namespace GATI.Tests.Auditoria;

/// <summary>
/// Testes do AuditService:
///   - SerializarParaAuditoria: lógica de serialização JSON com redução de fotos
///   - RegistrarLog: verifica que a fábrica de conexão é invocada corretamente
/// </summary>
public class AuditServiceTests
{
    // ──────────────────────── SerializarParaAuditoria ────────────────────────

    [Fact]
    public void SerializarParaAuditoria_EntradaNula_RetornaNull()
    {
        var result = AuditService.SerializarParaAuditoria(null);

        result.Should().BeNull();
    }

    [Fact]
    public void SerializarParaAuditoria_ObjetoSemFotos_RetornaJsonSerializado()
    {
        var obj = new { Id = 1, Nome = "Notebook Dell", Tipo = "Laptop" };

        var result = AuditService.SerializarParaAuditoria(obj);

        result.Should().NotBeNullOrEmpty();
        result.Should().Contain("Notebook Dell");
        result.Should().Contain("Laptop");
    }

    [Fact]
    public void SerializarParaAuditoria_ObjetoComFotos_SubstituiArrayPorContagem()
    {
        // Três fotos em base64 devem ser substituídas pelo número 3
        var obj = new
        {
            Id = 1,
            Nome = "Notebook",
            Fotos = new[] { "base64_foto1", "base64_foto2", "base64_foto3" }
        };

        var result = AuditService.SerializarParaAuditoria(obj);

        result.Should().NotBeNullOrEmpty();
        result.Should().Contain("\"Fotos\":3");
        result.Should().NotContain("base64_foto1");
    }

    [Fact]
    public void SerializarParaAuditoria_FotosVazias_RetornaZero()
    {
        var obj = new { Id = 1, Fotos = Array.Empty<string>() };

        var result = AuditService.SerializarParaAuditoria(obj);

        result.Should().Contain("\"Fotos\":0");
    }

    [Fact]
    public void SerializarParaAuditoria_ChaveFotosMinuscula_TambemSubstitui()
    {
        // Suporta "fotos" (snake_case) além de "Fotos"
        var json = "{\"id\":1,\"fotos\":[\"base64_a\",\"base64_b\"]}";
        var obj = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);

        var result = AuditService.SerializarParaAuditoria(obj);

        result.Should().Contain("\"fotos\":2");
        result.Should().NotContain("base64_a");
    }

    [Fact]
    public void SerializarParaAuditoria_ObjetoSimples_RetornaJsonValido()
    {
        var obj = new { Nome = "Test", Ativo = true, Valor = 1500.50m };

        var result = AuditService.SerializarParaAuditoria(obj);

        // Deve ser JSON válido (não deve lançar exceção)
        var act = () => JsonSerializer.Deserialize<object>(result!);
        act.Should().NotThrow();
    }

    // ──────────────────────── RegistrarLog ────────────────────────

    [Fact]
    public async Task RegistrarLog_DadosValidos_CriaConexaoComBancoDeDados()
    {
        var (mockFactory, _) = CriarMockDb();
        var sut = new AuditService(mockFactory.Object);

        await sut.RegistrarLog(
            usuarioId: 1,
            acao: "CRIAÇÃO",
            entidade: "Equipamento",
            entidadeId: 42);

        // Deve ter criado uma conexão com o banco
        mockFactory.Verify(f => f.Create(), Times.Once);
    }

    [Fact]
    public async Task RegistrarLog_ComDadosAnterioresENovosFornecidos_NaoLancaExcecao()
    {
        var (mockFactory, _) = CriarMockDb();
        var sut = new AuditService(mockFactory.Object);

        var act = async () => await sut.RegistrarLog(
            usuarioId: 5,
            acao: "EDIÇÃO",
            entidade: "Equipamento",
            entidadeId: 10,
            dadosAnteriores: new { Nome = "Dell Antigo" },
            dadosNovos: new { Nome = "Dell Novo" },
            ip: "192.168.1.100");

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task RegistrarLog_ComFotosNosDados_SerializaFotosSemBase64()
    {
        // Garante que o registro não lança exceção mesmo com arrays de fotos grandes
        var (mockFactory, _) = CriarMockDb();
        var sut = new AuditService(mockFactory.Object);
        var dadosComFotos = new
        {
            Id = 1,
            Fotos = new[] { new string('A', 50000), new string('B', 50000) } // fotos grandes
        };

        var act = async () => await sut.RegistrarLog(
            usuarioId: 1, acao: "EDIÇÃO", entidade: "Equipamento",
            entidadeId: 1, dadosAnteriores: dadosComFotos);

        await act.Should().NotThrowAsync();
    }

    // ──────────────────────── Helpers ────────────────────────

    private static (Mock<IDbConnectionFactory> factory, Mock<IDbConnection> conn) CriarMockDb()
    {
        var mockFactory = new Mock<IDbConnectionFactory>();
        var mockConn = new Mock<IDbConnection>();
        var mockCmd = new Mock<IDbCommand>();
        var mockParams = new Mock<IDataParameterCollection>();
        var mockParam = new Mock<IDbDataParameter>();

        mockParam.SetupAllProperties();
        mockCmd.SetupGet(c => c.Parameters).Returns(mockParams.Object);
        mockCmd.Setup(c => c.CreateParameter()).Returns(mockParam.Object);
        mockCmd.Setup(c => c.ExecuteNonQuery()).Returns(1);
        mockConn.SetupGet(c => c.State).Returns(ConnectionState.Open);
        mockConn.Setup(c => c.CreateCommand()).Returns(mockCmd.Object);
        mockFactory.Setup(f => f.Create()).Returns(mockConn.Object);

        return (mockFactory, mockConn);
    }
}
