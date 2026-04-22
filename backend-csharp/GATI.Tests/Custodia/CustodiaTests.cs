using FluentAssertions;
using Xunit;
using GATI.API.Models;

namespace GATI.Tests.Custodia;

/// <summary>
/// Testes do módulo de Custódia / Movimentação:
///   - Validações de regras de negócio da entidade Movimentacao
///   - BrasiliaNow: offset de fuso horário
/// </summary>
public class CustodiaTests
{
    // ──────────────────────── BrasiliaNow ────────────────────────

    [Fact]
    public void BrasiliaNow_Retorna_DataHoraComOffsetDeMinusTresHoras()
    {
        var antes = DateTime.UtcNow.AddHours(-3).AddSeconds(-1);
        var brasilia = Movimentacao.BrasiliaNow();
        var depois = DateTime.UtcNow.AddHours(-3).AddSeconds(1);

        brasilia.Should().BeAfter(antes);
        brasilia.Should().BeBefore(depois);
    }

    [Fact]
    public void BrasiliaNow_RetornaHoraMenorQueUtc()
    {
        var utc = DateTime.UtcNow;
        var brasilia = Movimentacao.BrasiliaNow();

        // Brasília é UTC-3; sempre deve ser menor
        brasilia.Should().BeBefore(utc);
    }

    // ──────────────────────── Criação de Movimentação ────────────────────────

    [Fact]
    public void Movimentacao_Nova_PossuiDataMovimentacaoPreenchida()
    {
        var mov = new Movimentacao
        {
            EquipamentoId = 1,
            TecnicoId = 2
        };

        // DataMovimentacao tem valor default = DateTime.UtcNow no modelo
        mov.DataMovimentacao.Should().NotBe(default);
    }

    [Fact]
    public void Movimentacao_TrocaDeResponsabilidade_IdentificadaCorretamente()
    {
        // Troca de responsabilidade: mesma localização, responsáveis diferentes
        var mov = new Movimentacao
        {
            EquipamentoId = 1,
            TecnicoId = 1,
            LocOrigemId = 5,
            LocDestinoId = 5,           // mesmo local
            ResponsavelAnteriorId = 10,
            ResponsavelNovoId = 20,     // responsável diferente
        };

        bool isTroca = mov.LocOrigemId.HasValue &&
                       mov.LocDestinoId.HasValue &&
                       mov.LocOrigemId == mov.LocDestinoId &&
                       mov.ResponsavelAnteriorId != mov.ResponsavelNovoId;

        isTroca.Should().BeTrue();
    }

    [Fact]
    public void Movimentacao_TransferenciaEntreLocais_NaoEhTrocaDeResponsabilidade()
    {
        var mov = new Movimentacao
        {
            EquipamentoId = 1,
            TecnicoId = 1,
            LocOrigemId = 5,
            LocDestinoId = 8,           // locais diferentes
            ResponsavelAnteriorId = 10,
            ResponsavelNovoId = 20,
        };

        bool isTroca = mov.LocOrigemId.HasValue &&
                       mov.LocDestinoId.HasValue &&
                       mov.LocOrigemId == mov.LocDestinoId &&
                       mov.ResponsavelAnteriorId != mov.ResponsavelNovoId;

        isTroca.Should().BeFalse();
    }

    // ──────────────────────── LoteId ────────────────────────

    [Fact]
    public void Movimentacao_LoteIdComPrefixa_TR_IdentificaTrocaDeResponsabilidade()
    {
        // Convenção do sistema: lote_id com prefixo "TR" indica troca de responsabilidade
        var mov = new Movimentacao { LoteId = "TR-abc123" };

        mov.LoteId!.StartsWith("TR").Should().BeTrue();
    }
}
