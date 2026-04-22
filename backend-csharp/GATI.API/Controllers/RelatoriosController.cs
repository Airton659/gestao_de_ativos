using Microsoft.AspNetCore.Mvc;
using GATI.API.Data;
using GATI.API.DTOs;
using GATI.API.Middleware;
using GATI.API.Services;

namespace GATI.API.Controllers;

[Route("api/v1/relatorios")]
[ApiController]
public class RelatoriosController : ControllerBase
{
    private readonly RelatorioService _relatorioService;
    private readonly PdfService _pdfService;

    public RelatoriosController(RelatorioService relatorioService, PdfService pdfService)
    {
        _relatorioService = relatorioService;
        _pdfService = pdfService;
    }

    // R01 — Inventário Geral
    [HttpGet("inventario")]
    [RequirePermission("relatorios:gerar")]
    public async Task<IActionResult> GetInventario([FromQuery] R01InventarioRequest req)
    {
        var semLocalizacao = req.LocalizacaoIds == null || !req.LocalizacaoIds.Any();
        var semPeriodo     = req.DataAquisicaoInicio == null;
        if (semLocalizacao && semPeriodo)
            return BadRequest(new { detail = "Informe ao menos uma localização ou período de aquisição para gerar o inventário." });

        var emissor = User.Identity?.Name ?? "Sistema";
        var (rows, totais) = await _relatorioService.GetInventario(req);
        var pdf = _pdfService.GenerateRelatorioInventario(rows, totais, req, emissor);
        return File(pdf, "application/pdf", "relatorio-inventario.pdf");
    }

    // R02 — Por Localização
    [HttpGet("localizacao")]
    [RequirePermission("relatorios:gerar")]
    public async Task<IActionResult> GetLocalizacao([FromQuery] R02LocalizacaoRequest req)
    {
        var emissor = User.Identity?.Name ?? "Sistema";
        var rows = await _relatorioService.GetPorLocalizacao(req);
        var pdf  = _pdfService.GenerateRelatorioLocalizacao(rows, req, emissor);
        return File(pdf, "application/pdf", "relatorio-ativos-por-localizacao.pdf");
    }

    // R03 — Histórico de Movimentações
    [HttpGet("historico")]
    [RequirePermission("relatorios:gerar")]
    public async Task<IActionResult> GetHistorico([FromQuery] R03HistoricoRequest req)
    {
        if (req.PeriodoInicio == default || req.PeriodoFim == default)
            return BadRequest(new { detail = "Período é obrigatório para o relatório de histórico." });

        var emissor = User.Identity?.Name ?? "Sistema";
        var rows = await _relatorioService.GetHistorico(req);
        var pdf  = _pdfService.GenerateRelatorioHistorico(rows, req, emissor);
        return File(pdf, "application/pdf", "relatorio-historico-movimentacoes.pdf");
    }

    // R04 — Por Responsável
    [HttpGet("responsavel")]
    [RequirePermission("relatorios:gerar")]
    public async Task<IActionResult> GetResponsavel([FromQuery] R04ResponsavelRequest req)
    {
        var emissor = User.Identity?.Name ?? "Sistema";
        var rows = await _relatorioService.GetPorResponsavel(req);
        var pdf  = _pdfService.GenerateRelatorioResponsavel(rows, req, emissor);
        return File(pdf, "application/pdf", "relatorio-ativos-por-responsavel.pdf");
    }

    // R05 — Manutenção / Depreciados
    [HttpGet("manutencao")]
    [RequirePermission("relatorios:gerar")]
    public async Task<IActionResult> GetManutencao([FromQuery] R05ManutencaoRequest req)
    {
        var emissor = User.Identity?.Name ?? "Sistema";
        var rows = await _relatorioService.GetManutencao(req);
        var pdf  = _pdfService.GenerateRelatorioManutencao(rows, req, emissor);
        return File(pdf, "application/pdf", "relatorio-manutencao.pdf");
    }

    // R06 — Termos
    [HttpGet("termos")]
    [RequirePermission("relatorios:gerar")]
    public async Task<IActionResult> GetTermos([FromQuery] R06TermosRequest req)
    {
        var emissor = User.Identity?.Name ?? "Sistema";
        var rows = await _relatorioService.GetTermos(req);
        var pdf  = _pdfService.GenerateRelatorioTermos(rows, req, emissor);
        return File(pdf, "application/pdf", "relatorio-termos.pdf");
    }
}
