using FluentAssertions;
using Xunit;
using GATI.API.Models;
using GATI.API.Services;

namespace GATI.Tests.Pdf;

/// <summary>
/// Testes do PdfService: verifica que o documento é gerado sem exceção
/// e que retorna bytes válidos. Não depende de banco de dados.
/// </summary>
public class PdfServiceTests
{
    private readonly PdfService _sut = new();

    // ──────────────────────── GenerateLotePdf ────────────────────────

    [Fact]
    public void GenerateLotePdf_ListaVazia_RetornaArrayVazio()
    {
        var result = _sut.GenerateLotePdf([]);

        result.Should().BeEmpty();
    }

    [Fact]
    public void GenerateLotePdf_MovimentacaoValida_RetornaBytesNaoVazios()
    {
        var movimentacoes = new List<Movimentacao> { CriarMovimentacao() };

        var result = _sut.GenerateLotePdf(movimentacoes);

        result.Should().NotBeEmpty();
    }

    [Fact]
    public void GenerateLotePdf_MovimentacaoValida_RetornaAssinaturaDeArquivoPdf()
    {
        // PDF começa com os bytes %PDF (0x25 0x50 0x44 0x46)
        var movimentacoes = new List<Movimentacao> { CriarMovimentacao() };

        var result = _sut.GenerateLotePdf(movimentacoes);

        result.Should().HaveCountGreaterThan(4);
        result[0].Should().Be(0x25); // %
        result[1].Should().Be(0x50); // P
        result[2].Should().Be(0x44); // D
        result[3].Should().Be(0x46); // F
    }

    [Fact]
    public void GenerateLotePdf_MultiplasMovimentacoes_NaoLancaExcecao()
    {
        var movimentacoes = Enumerable.Range(1, 5)
            .Select(i => CriarMovimentacao(equipamentoNome: $"Notebook #{i}"))
            .ToList();

        var act = () => _sut.GenerateLotePdf(movimentacoes);

        act.Should().NotThrow();
    }

    [Fact]
    public void GenerateLotePdf_MovimentacaoSemAssinaturas_NaoLancaExcecao()
    {
        // Assinaturas opcionais — documento deve ser gerado mesmo sem elas
        var mov = CriarMovimentacao();
        mov.Tecnico!.AssinaturaUrl = null;
        mov.ResponsavelNovo!.AssinaturaUrl = null;
        mov.FotoAssinaturaUrl = null;

        var act = () => _sut.GenerateLotePdf([mov]);

        act.Should().NotThrow();
    }

    // ──────────────────────── GenerateMovimentacaoPdf ────────────────────────

    [Fact]
    public void GenerateMovimentacaoPdf_MovimentacaoValida_RetornaBytesNaoVazios()
    {
        var mov = CriarMovimentacao();

        var result = _sut.GenerateMovimentacaoPdf(mov);

        result.Should().NotBeEmpty();
    }

    // ──────────────────────── Helpers ────────────────────────

    private static Movimentacao CriarMovimentacao(string equipamentoNome = "Notebook Dell") => new()
    {
        Id = 1,
        EquipamentoId = 10,
        TecnicoId = 1,
        LocOrigemId = 1,
        LocDestinoId = 2,
        ResponsavelAnteriorId = 5,
        ResponsavelNovoId = 6,
        DataMovimentacao = DateTime.UtcNow,
        Motivo = "Troca de setor",
        Equipamento = new Equipamento
        {
            Id = 10,
            NumeroPatrimonio = "PAT-001",
            Nome = equipamentoNome,
            Tipo = "Laptop",
            Marca = "Dell",
            Modelo = "Inspiron 15",
            NumeroSerie = "SN12345",
            EstadoConservacao = "Bom"
        },
        Tecnico = new Usuario
        {
            Id = 1,
            Nome = "Técnico TI",
            Matricula = "TI001",
            Email = "tecnico@example.com"
        },
        ResponsavelAnterior = new Usuario
        {
            Id = 5,
            Nome = "Responsável Anterior",
            Matricula = "RE001",
            Email = "anterior@example.com"
        },
        ResponsavelNovo = new Usuario
        {
            Id = 6,
            Nome = "Responsável Novo",
            Matricula = "RN001",
            Email = "novo@example.com"
        }
    };
}
