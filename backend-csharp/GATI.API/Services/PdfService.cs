using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using GATI.API.Models;

namespace GATI.API.Services;

public class PdfService
{
    private const string LogoName = "logo.png";

    public byte[] GenerateLotePdf(List<Movimentacao> movimentacoes)
    {
        if (movimentacoes == null || !movimentacoes.Any()) return Array.Empty<byte>();

        QuestPDF.Settings.License = LicenseType.Community;

        var first = movimentacoes.First();
        var dataMov = first.DataMovimentacao;
        var gestor = first.ResponsavelNovo;
        var tecnico = first.Tecnico;
        
        bool isTrocaResponsabilidade = first.LocOrigemId.HasValue && first.LocDestinoId.HasValue && 
                                       first.LocOrigemId == first.LocDestinoId && 
                                       first.ResponsavelAnteriorId != first.ResponsavelNovoId;

        // Caminho da logo
        var logoPath = Path.Combine(Directory.GetCurrentDirectory(), LogoName);
        
        // Foto de confirmação e assinaturas armazenadas como data URI no banco
        static byte[]? DecodeAssinatura(string? dataUri)
        {
            if (string.IsNullOrEmpty(dataUri)) return null;
            var parts = dataUri.Split(',', 2);
            if (parts.Length != 2) return null;
            try { return Convert.FromBase64String(parts[1]); } catch { return null; }
        }

        var gestorAssinaturaBytes = DecodeAssinatura(gestor?.AssinaturaUrl);
        var tecnicoAssinaturaBytes = DecodeAssinatura(tecnico?.AssinaturaUrl);
        var fotoBytes = DecodeAssinatura(first.FotoAssinaturaUrl);

        var responsavelAnterior = first.ResponsavelAnterior;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9).FontColor(Colors.Grey.Darken3).FontFamily("Helvetica"));

                // ── HEADER ──────────────────────────────────────────────────
                page.Header().PaddingBottom(0.3f, Unit.Centimetre).Row(row =>
                {
                    if (File.Exists(logoPath))
                    {
                        row.ConstantItem(120).Image(logoPath);
                    }
                    else
                    {
                        row.ConstantItem(120).Column(c => {
                            c.Item().Text("SISTEMA DE GESTÃO DE ATIVOS").FontSize(24).SemiBold().FontColor(Colors.Blue.Medium);
                        });
                    }

                    row.RelativeItem().Column(col =>
                    {
                        col.Item().AlignRight().Text(isTrocaResponsabilidade ? "TERMO DE TROCA DE RESPONSABILIDADE" : "TERMO DE RESPONSABILIDADE").FontSize(16).SemiBold().FontColor(Colors.Blue.Medium);
                        col.Item().AlignRight().Text(isTrocaResponsabilidade ? "Transferência de Gestão do Equipamento de TI" : "Checklist de Entrega de Equipamentos de TI").FontSize(10).Italic();
                    });
                });

                page.Content().Column(col =>
                {
                    col.Spacing(10);

                    // ── SEÇÃO 1: IDENTIFICAÇÃO ────────────────────────────────
                    col.Item().Text("1. Identificação do Colaborador").SemiBold().FontColor(Colors.Blue.Medium).FontSize(10);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(120);
                            columns.RelativeColumn();
                        });

                        if (isTrocaResponsabilidade)
                        {
                            table.Cell().ColumnSpan(2).Background(Colors.Blue.Medium).Padding(4)
                                .Text("NOVO RESPONSÁVEL").FontColor(Colors.White).SemiBold().FontSize(8);
                        }

                        table.Cell().Background(Colors.Blue.Lighten5).Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text("Nome Completo").SemiBold();
                        table.Cell().Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text(gestor?.Nome ?? "---");

                        table.Cell().Background(Colors.Blue.Lighten5).Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text("Usuário").SemiBold();
                        table.Cell().Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text(gestor?.Matricula ?? "---");

                        table.Cell().Background(Colors.Blue.Lighten5).Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text("Cargo / Função").SemiBold();
                        table.Cell().Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text(gestor?.Perfil?.Nome ?? "---");

                        if (isTrocaResponsabilidade)
                        {
                            table.Cell().ColumnSpan(2).Background(Colors.Grey.Medium).Padding(4)
                                .Text("RESPONSÁVEL ANTERIOR").FontColor(Colors.White).SemiBold().FontSize(8);

                            table.Cell().Background(Colors.Blue.Lighten5).Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text("Nome Completo").SemiBold();
                            table.Cell().Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text(responsavelAnterior?.Nome ?? "---");

                            table.Cell().Background(Colors.Blue.Lighten5).Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text("Usuário").SemiBold();
                            table.Cell().Border(0.5f).BorderColor(Colors.Blue.Lighten4).Padding(4).Text(responsavelAnterior?.Matricula ?? "---");
                        }
                    });

                    // ── SEÇÃO 2: EQUIPAMENTOS ─────────────────────────────────
                    col.Item().PaddingTop(5).Text("2. Descrição dos Equipamentos").SemiBold().FontColor(Colors.Blue.Medium).FontSize(10);
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(3);
                            columns.RelativeColumn(2);
                            columns.RelativeColumn(2);
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(Colors.Blue.Medium).Padding(4).Text("Tipo").FontColor(Colors.White).SemiBold();
                            header.Cell().Background(Colors.Blue.Medium).Padding(4).Text("Marca / Modelo").FontColor(Colors.White).SemiBold();
                            header.Cell().Background(Colors.Blue.Medium).Padding(4).Text("Nº de Série").FontColor(Colors.White).SemiBold();
                            header.Cell().Background(Colors.Blue.Medium).Padding(4).Text("Patrimônio").FontColor(Colors.White).SemiBold();
                        });

                        foreach (var m in movimentacoes)
                        {
                            var patrimonio = m.Equipamento?.IsProprio == false && m.Equipamento?.Fornecedor != null
                                ? $"({m.Equipamento.Fornecedor.Sigla}) {m.Equipamento.NumeroPatrimonio}"
                                : m.Equipamento?.NumeroPatrimonio ?? "---";

                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(m.Equipamento?.Tipo ?? "---");
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text($"{m.Equipamento?.Marca} {m.Equipamento?.Modelo}".Trim());
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(m.Equipamento?.NumeroSerie ?? "---");
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(patrimonio);
                        }
                    });

                    if (!string.IsNullOrEmpty(first.Motivo))
                    {
                        col.Item().Background(Colors.Grey.Lighten4).Padding(5).Text(x => {
                            x.Span("Motivo: ").SemiBold();
                            x.Span(first.Motivo);
                        });
                    }

                    // ── SEÇÃO 3: TERMO JURÍDICO ───────────────────────────────
                    col.Item().PaddingTop(5).Text("3. Termo de Responsabilidade").SemiBold().FontColor(Colors.Blue.Medium).FontSize(10);
                    col.Item().Text(x => {
                        x.Span("Eu, ");
                        x.Span(gestor?.Nome ?? "________________").SemiBold();
                        if (isTrocaResponsabilidade) {
                             x.Span(", declaro que assumo a responsabilidade sobre o(s) equipamento(s) listados acima, comprometendo-me a:");
                        } else {
                             x.Span(", declaro que recebi o(s) equipamento(s) listados acima, em perfeitas condições de uso, comprometendo-me a:");
                        }
                    });

                    col.Item().PaddingLeft(10).Column(list =>
                    {
                        list.Spacing(2);
                        list.Item().Text("• Uso Exclusivo: Utilizar o equipamento estritamente para fins profissionais.");
                        list.Item().Text("• Zelo e Conservação: Zelar por sua integridade física, conservação e bom funcionamento.");
                        list.Item().Text("• Software: Não instalar ou alterar softwares sem autorização do setor de TI.");
                        list.Item().Text("• Comunicação: Notificar imediatamente a TI em caso de dano, perda ou extravio.");
                        list.Item().Text("• Devolução: Restituir o equipamento em condições equivalentes ao término do vínculo.");
                    });

                    col.Item().PaddingTop(5).Background(Colors.Blue.Lighten5).Border(1f).BorderColor(Colors.Blue.Medium).Padding(8).Text("Estou ciente de que danos causados por negligência ou mau uso poderão acarretar em responsabilidade administrativa e/ou financeira, conforme normas internas.").Italic().FontSize(8);

                    // ── SEÇÃO 4: CONFIRMAÇÃO E FOTO ──────────────────────────
                    col.Item().PaddingTop(5).Text("4. Confirmação de Recebimento").SemiBold().FontColor(Colors.Blue.Medium).FontSize(10);
                    col.Item().Text($"Data: {dataMov:dd/MM/yyyy} às {dataMov:HH:mm}").FontSize(8);

                    col.Item().Row(row =>
                    {
                        row.RelativeItem().PaddingTop(35).Column(sigArea =>
                        {
                            sigArea.Item().Row(sigRow =>
                            {
                                sigRow.RelativeItem().Column(s1 =>
                                {
                                    if (gestorAssinaturaBytes != null)
                                        s1.Item().AlignCenter().MaxHeight(50).Image(gestorAssinaturaBytes);
                                    else
                                        s1.Item().AlignCenter().Text("_________________________________");
                                    s1.Item().AlignCenter().Text(gestor?.Nome ?? "Responsável").SemiBold().FontSize(8);
                                    s1.Item().AlignCenter().Text("Responsável").FontSize(7);
                                });
                                sigRow.ConstantItem(20);
                                sigRow.RelativeItem().Column(s2 =>
                                {
                                    if (tecnicoAssinaturaBytes != null)
                                        s2.Item().AlignCenter().MaxHeight(50).Image(tecnicoAssinaturaBytes);
                                    else
                                        s2.Item().AlignCenter().Text("_________________________________");
                                    s2.Item().AlignCenter().Text(tecnico?.Nome ?? "Técnico").SemiBold().FontSize(8);
                                    s2.Item().AlignCenter().Text("Executante da Transferência").FontSize(7);
                                });
                            });
                        });

                        if (fotoBytes != null)
                        {
                            row.ConstantItem(120).PaddingLeft(10).Column(fArea =>
                            {
                                fArea.Item().Text(isTrocaResponsabilidade ? "Assinatura Digital" : "Foto de Confirmação").FontSize(7).AlignCenter().SemiBold();
                                fArea.Item().PaddingTop(2).Border(0.5f).BorderColor(Colors.Grey.Lighten2).Image(fotoBytes);
                            });
                        }
                    });
                });

                page.Footer().PaddingTop(1, Unit.Centimetre).Column(f => {
                    f.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                    f.Item().PaddingTop(5).AlignCenter().Text(x =>
                    {
                        x.Span("Página ");
                        x.CurrentPageNumber();
                        x.Span(" - SISTEMA DE GESTÃO DE ATIVOS").FontColor(Colors.Grey.Medium).FontSize(7);
                    });
                });
            });
        });

        return document.GeneratePdf();
    }

    public byte[] GenerateMovimentacaoPdf(Movimentacao mov)
    {
        return GenerateLotePdf(new List<Movimentacao> { mov });
    }

    // ── RELATÓRIOS ────────────────────────────────────────────────────────────

    // Método base: gera um PDF tabular padrão GATI
    private byte[] GerarRelatorioTabular(
        string titulo,
        Dictionary<string, string> filtros,
        string[] colunas,
        float[] larguras,
        IEnumerable<string[]> linhas,
        string emissor,
        string[]? totalizadores = null)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var logoPath = Path.Combine(Directory.GetCurrentDirectory(), LogoName);
        var dataGeracao = GATI.API.Models.Movimentacao.BrasiliaNow();
        var listaLinhas = linhas.ToList();

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(1.2f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(7).FontColor(Colors.Grey.Darken3).FontFamily("Helvetica"));

                // HEADER
                page.Header().PaddingBottom(0.3f, Unit.Centimetre).Row(row =>
                {
                    if (File.Exists(logoPath))
                        row.ConstantItem(100).Image(logoPath);
                    else
                        row.ConstantItem(100);

                    row.RelativeItem().Column(col =>
                    {
                        col.Item().AlignRight().Text(titulo).FontSize(13).SemiBold().FontColor(Colors.Blue.Medium);
                        col.Item().AlignRight().Text(x => {
                            x.Span($"Emitido em {dataGeracao:dd/MM/yyyy} às {dataGeracao:HH:mm}").FontSize(8).FontColor(Colors.Grey.Medium);
                            x.Span($" | Por: {emissor}").FontSize(8).FontColor(Colors.Grey.Medium);
                        });
                    });
                });

                page.Content().Column(col =>
                {
                    col.Spacing(8);

                    // Tabela
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cd =>
                        {
                            foreach (var l in larguras)
                                cd.RelativeColumn(l);
                        });

                        // Cabeçalho
                        table.Header(header =>
                        {
                            foreach (var c in colunas)
                                header.Cell().Background(Colors.Blue.Medium).Padding(3)
                                      .Text(c).FontColor(Colors.White).SemiBold().FontSize(7);
                        });

                        // Linhas zebra
                        for (int i = 0; i < listaLinhas.Count; i++)
                        {
                            var bg = i % 2 == 0 ? Colors.White : Colors.Blue.Lighten5;
                            foreach (var cell in listaLinhas[i])
                                table.Cell().Background(bg)
                                     .BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                                     .Padding(3).Text(cell ?? "—").FontSize(7);
                        }

                        // Totalizadores
                        if (totalizadores != null)
                            foreach (var t in totalizadores)
                                table.Cell().Background(Colors.Blue.Lighten4)
                                     .Padding(3).Text(t ?? "").SemiBold().FontSize(7);
                    });

                    if (listaLinhas.Count == 0)
                        col.Item().AlignCenter().PaddingVertical(20)
                           .Text("Nenhum registro encontrado para os filtros selecionados.")
                           .Italic().FontColor(Colors.Grey.Medium);
                });

                // FOOTER
                page.Footer().PaddingTop(0.5f, Unit.Centimetre).Column(f =>
                {
                    f.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                    f.Item().PaddingTop(4).Row(r =>
                    {
                        r.RelativeItem().AlignLeft()
                         .Text($"Total de registros: {listaLinhas.Count}").FontSize(7).FontColor(Colors.Grey.Medium);
                        r.RelativeItem().AlignCenter().Text(x =>
                        {
                            x.Span("Página ").FontSize(7).FontColor(Colors.Grey.Medium);
                            x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                            x.Span(" de ").FontSize(7).FontColor(Colors.Grey.Medium);
                            x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                        });
                        r.RelativeItem().AlignRight()
                         .Text("SISTEMA DE GESTÃO DE ATIVOS").FontSize(7).FontColor(Colors.Grey.Medium);
                    });
                });
            });
        });

        return document.GeneratePdf();
    }

    // ── R01 — Inventário Geral (agrupado por localização) ────────────────────
    public byte[] GenerateRelatorioInventario(List<DTOs.R01Row> rows, DTOs.R01Totais totais, DTOs.R01InventarioRequest req, string emissor)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var logoPath = Path.Combine(Directory.GetCurrentDirectory(), LogoName);
        var dataGeracao = GATI.API.Models.Movimentacao.BrasiliaNow();

        // Colunas sem LOCAL (agrupamento já fornece o contexto)
        float[] larguras = { 2.5f, 1.5f, 3f, 2f, 1.5f, 2f, 2f, 2f, 2f, 2.5f, 2.5f };
        string[] headers = { "PATRIMÔNIO", "TIPO", "MARCA/MODELO", "SÉRIE", "STATUS", "CONSERVAÇÃO", "PROPRIEDADE", "AQUISIÇÃO", "VALOR", "FORNECEDOR", "RESPONSÁVEL" };

        // Agrupa mantendo a ordem original (já vem ordenada por localização da query)
        var grupos = rows
            .GroupBy(r => r.Localizacao)
            .Select(g => (Local: g.Key, Itens: g.ToList()))
            .ToList();

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(1.2f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(7).FontColor(Colors.Grey.Darken3).FontFamily("Helvetica"));

                // HEADER
                page.Header().PaddingBottom(0.3f, Unit.Centimetre).Row(row =>
                {
                    if (File.Exists(logoPath))
                        row.ConstantItem(100).Image(logoPath);
                    else
                        row.ConstantItem(100);

                    row.RelativeItem().Column(col =>
                    {
                        col.Item().AlignRight().Text("INVENTÁRIO GERAL DE ATIVOS").FontSize(13).SemiBold().FontColor(Colors.Blue.Medium);
                        col.Item().AlignRight().Text(x => {
                            x.Span($"Emitido em {dataGeracao:dd/MM/yyyy} às {dataGeracao:HH:mm}").FontSize(8).FontColor(Colors.Grey.Medium);
                            x.Span($" | Por: {emissor}").FontSize(8).FontColor(Colors.Grey.Medium);
                        });
                    });
                });

                page.Content().Column(col =>
                {
                    col.Spacing(10);

                    foreach (var (local, itens) in grupos)
                    {
                        // Faixa com o nome completo da localização
                        col.Item()
                           .Background(Colors.Blue.Medium)
                           .Padding(5)
                           .Text(string.IsNullOrWhiteSpace(local) ? "Sem localização definida" : local)
                           .FontColor(Colors.White).SemiBold().FontSize(9);

                        col.Item().Table(table =>
                        {
                            table.ColumnsDefinition(cd =>
                            {
                                foreach (var l in larguras) cd.RelativeColumn(l);
                            });

                            table.Header(header =>
                            {
                                foreach (var h in headers)
                                    header.Cell().Background(Colors.Blue.Lighten2).Padding(3)
                                          .Text(h).FontColor(Colors.White).SemiBold().FontSize(7);
                            });

                            for (int i = 0; i < itens.Count; i++)
                            {
                                var r = itens[i];
                                var bg = i % 2 == 0 ? Colors.White : Colors.Blue.Lighten5;
                                string[] cells = {
                                    r.NumeroPatrimonio, r.Tipo, r.MarcaModelo, r.NumeroSerie,
                                    r.Status, r.EstadoConservacao, r.Propriedade,
                                    r.DataAquisicao, r.Valor, r.Fornecedor, r.Responsavel
                                };
                                foreach (var cell in cells)
                                    table.Cell().Background(bg)
                                         .BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2)
                                         .Padding(3).Text(cell ?? "—").FontSize(7);
                            }
                        });

                        // Totalizador do grupo (por localidade)
                        var gTotal = itens.Count;
                        var gAtivos = itens.Count(x => x.Status == "ATIVO");
                        var gInativos = itens.Count(x => x.Status == "INATIVO");
                        var gValor = itens.Sum(x => x.ValorNumerico);
                        var gTipoStr = string.Join("  |  ", itens
                            .Where(x => !string.IsNullOrWhiteSpace(x.Tipo))
                            .GroupBy(x => x.Tipo)
                            .OrderBy(g => g.Key)
                            .Select(g => $"{g.Key}: {g.Count()}"));

                        col.Item().PaddingBottom(5)
                           .Background(Colors.Grey.Lighten4).Padding(5)
                           .Column(tc =>
                           {
                               tc.Item().Text($"SUBTOTAL (LOCAL): {gTotal} itens  |  Ativos: {gAtivos}  |  Inativos: {gInativos}  |  Valor: R$ {gValor:N2}")
                                 .SemiBold().FontSize(7).FontColor(Colors.Blue.Medium);
                               if (!string.IsNullOrWhiteSpace(gTipoStr))
                                   tc.Item().PaddingTop(2).Text($"Por tipo:  {gTipoStr}")
                                     .FontSize(7).FontColor(Colors.Blue.Darken1);
                           });
                    }

                    if (rows.Count == 0)
                        col.Item().AlignCenter().PaddingVertical(20)
                           .Text("Nenhum registro encontrado para os filtros selecionados.")
                           .Italic().FontColor(Colors.Grey.Medium);

                    // Totalizadores
                    var totalTipoStr = string.Join("  |  ", rows
                        .Where(x => !string.IsNullOrWhiteSpace(x.Tipo))
                        .GroupBy(x => x.Tipo)
                        .OrderBy(g => g.Key)
                        .Select(g => $"{g.Key}: {g.Count()}"));

                    col.Item().PaddingTop(4)
                       .Background(Colors.Blue.Lighten4).Padding(6)
                       .Column(tc =>
                       {
                           tc.Item().Text($"TOTAL GERAL: {totais.Total} equipamentos  |  Ativos: {totais.Ativos}  |  Inativos: {totais.Inativos}  |  Valor total: R$ {totais.ValorTotal:N2}")
                             .SemiBold().FontSize(8);
                           if (!string.IsNullOrWhiteSpace(totalTipoStr))
                               tc.Item().PaddingTop(2).Text($"Por tipo:  {totalTipoStr}")
                                 .FontSize(7).FontColor(Colors.Blue.Darken1);
                       });
                });

                // FOOTER
                page.Footer().PaddingTop(0.5f, Unit.Centimetre).Column(f =>
                {
                    f.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                    f.Item().PaddingTop(4).Row(r =>
                    {
                        r.RelativeItem().AlignLeft()
                         .Text($"Total de registros: {rows.Count}").FontSize(7).FontColor(Colors.Grey.Medium);
                        r.RelativeItem().AlignCenter().Text(x =>
                        {
                            x.Span("Página ").FontSize(7).FontColor(Colors.Grey.Medium);
                            x.CurrentPageNumber().FontSize(7).FontColor(Colors.Grey.Medium);
                            x.Span(" de ").FontSize(7).FontColor(Colors.Grey.Medium);
                            x.TotalPages().FontSize(7).FontColor(Colors.Grey.Medium);
                        });
                        r.RelativeItem().AlignRight()
                         .Text("SISTEMA DE GESTÃO DE ATIVOS").FontSize(7).FontColor(Colors.Grey.Medium);
                    });
                });
            });
        });

        return document.GeneratePdf();
    }

    // ── R02 — Por Localização ─────────────────────────────────────────────────
    public byte[] GenerateRelatorioLocalizacao(List<DTOs.R02Row> rows, DTOs.R02LocalizacaoRequest req, string emissor)
    {
        var filtros = new Dictionary<string, string>();
        if (req.Campus?.Any() == true) filtros["Campus"] = string.Join(", ", req.Campus);
        if (req.Blocos?.Any() == true) filtros["Blocos"] = string.Join(", ", req.Blocos);
        if (req.Tipos?.Any() == true)  filtros["Tipos"] = string.Join(", ", req.Tipos);
        filtros["Salas vazias"] = req.IncluirSalasVazias ? "Incluídas" : "Excluídas";

        var cols = new[] { "CAMPUS", "BLOCO", "SALA", "TOTAL", "ATIVOS", "INATIVOS", "TIPOS PRESENTES" };
        var larg = new float[] { 2.5f, 2f, 2f, 1f, 1f, 1f, 5f };

        var linhas = rows.Select(r => new[]
        {
            r.Campus, r.Bloco, r.Sala,
            r.TotalEquipamentos.ToString(), r.Ativos.ToString(), r.Inativos.ToString(),
            r.Tipos
        });

        var tots = new string[cols.Length];
        tots[0] = $"TOTAL SALAS: {rows.Count}";
        tots[3] = rows.Sum(r => r.TotalEquipamentos).ToString();
        tots[4] = rows.Sum(r => r.Ativos).ToString();
        tots[5] = rows.Sum(r => r.Inativos).ToString();
        for (int i = 0; i < cols.Length; i++) tots[i] ??= "";

        return GerarRelatorioTabular("ATIVOS POR LOCALIZAÇÃO", filtros, cols, larg, linhas, emissor, tots);
    }

    // ── R03 — Histórico ───────────────────────────────────────────────────────
    public byte[] GenerateRelatorioHistorico(List<DTOs.R03Row> rows, DTOs.R03HistoricoRequest req, string emissor)
    {
        var filtros = new Dictionary<string, string>
        {
            ["Período"] = $"{req.PeriodoInicio:dd/MM/yyyy} a {req.PeriodoFim:dd/MM/yyyy}"
        };
        if (req.EquipamentoIds?.Any() == true) filtros["Equipamentos (IDs)"] = string.Join(", ", req.EquipamentoIds);
        if (req.TecnicoIds?.Any() == true)     filtros["Técnicos (IDs)"] = string.Join(", ", req.TecnicoIds);

        var cols = new[] { "DATA", "PATRIMÔNIO", "TIPO", "TÉCNICO", "GESTOR", "ORIGEM", "DESTINO", "MOTIVO", "TERMO" };
        var larg = new float[] { 2f, 2f, 1.5f, 2.5f, 2.5f, 2.5f, 2.5f, 3f, 1f };

        var linhas = rows.Select(r => new[]
        {
            r.DataMovimentacao, r.Patrimonio, r.Tipo,
            r.Tecnico, r.Gestor, r.Origem, r.Destino, r.Motivo, r.ComTermo
        });

        var tots = new string[cols.Length];
        tots[0] = $"TOTAL: {rows.Count}";
        for (int i = 1; i < cols.Length; i++) tots[i] = "";

        return GerarRelatorioTabular("HISTÓRICO DE MOVIMENTAÇÕES", filtros, cols, larg, linhas, emissor, tots);
    }

    // ── R04 — Por Responsável ─────────────────────────────────────────────────
    public byte[] GenerateRelatorioResponsavel(List<DTOs.R04Row> rows, DTOs.R04ResponsavelRequest req, string emissor)
    {
        var filtros = new Dictionary<string, string>();
        if (req.ResponsavelIds?.Any() == true) filtros["Responsáveis (IDs)"] = string.Join(", ", req.ResponsavelIds);
        if (req.Tipos?.Any() == true)          filtros["Tipos"] = string.Join(", ", req.Tipos);
        if (req.ValorMinimo.HasValue)          filtros["Valor mínimo"] = $"R$ {req.ValorMinimo.Value:N2}";

        var cols = new[] { "RESPONSÁVEL", "USUÁRIO", "TIPO", "QUANTIDADE", "VALOR TOTAL" };
        var larg = new float[] { 4f, 2f, 2.5f, 1.5f, 2.5f };

        var linhas = rows.Select(r => new[]
        {
            r.Responsavel, r.Matricula, r.Tipo,
            r.Quantidade.ToString(),
            $"R$ {r.ValorTotal:N2}"
        });

        var tots = new string[cols.Length];
        tots[0] = $"TOTAL REGISTROS: {rows.Count}";
        tots[3] = rows.Sum(r => r.Quantidade).ToString();
        tots[4] = $"R$ {rows.Sum(r => r.ValorTotal):N2}";
        for (int i = 0; i < cols.Length; i++) tots[i] ??= "";

        return GerarRelatorioTabular("ATIVOS POR RESPONSÁVEL", filtros, cols, larg, linhas, emissor, tots);
    }

    // ── R05 — Manutenção ──────────────────────────────────────────────────────
    public byte[] GenerateRelatorioManutencao(List<DTOs.R05Row> rows, DTOs.R05ManutencaoRequest req, string emissor)
    {
        var filtros = new Dictionary<string, string>();
        if (req.EstadosConservacao?.Any() == true) filtros["Conservação"] = string.Join(", ", req.EstadosConservacao);
        if (req.AnosMinimos.HasValue)              filtros["Idade mínima"] = $"{req.AnosMinimos.Value} anos";
        if (req.Tipos?.Any() == true)              filtros["Tipos"] = string.Join(", ", req.Tipos);
        if (req.LocalizacaoIds?.Any() == true)     filtros["Localizações (IDs)"] = string.Join(", ", req.LocalizacaoIds);
        filtros["Observação"] = "Lista apenas equipamentos inativos";

        var cols = new[] { "PATRIMÔNIO", "TIPO", "MARCA / MODELO", "CONSERVAÇÃO", "AQUISIÇÃO", "ANOS USO", "LOCAL", "RESPONSÁVEL", "OBSERVAÇÕES" };
        var larg = new float[] { 2f, 1.5f, 2.8f, 1.8f, 1.5f, 1.2f, 2.8f, 2.4f, 3f };

        var linhas = rows.Select(r => new[]
        {
            r.NumeroPatrimonio, r.Tipo, r.MarcaModelo, r.EstadoConservacao,
            r.DataAquisicao, r.AnosUso.ToString(), r.Localizacao, r.Responsavel, r.Observacoes
        });

        var tots = new string[cols.Length];
        tots[0] = $"TOTAL INATIVOS: {rows.Count}";
        for (int i = 1; i < cols.Length; i++) tots[i] = "";

        return GerarRelatorioTabular("EQUIPAMENTOS INATIVOS (BENS FORA DE USO)", filtros, cols, larg, linhas, emissor, tots);
    }

    // ── R06 — Termos ──────────────────────────────────────────────────────────
    public byte[] GenerateRelatorioTermos(List<DTOs.R06Row> rows, DTOs.R06TermosRequest req, string emissor)
    {
        var filtros = new Dictionary<string, string>();
        if (req.GestorIds?.Any() == true)            filtros["Gestores (IDs)"] = string.Join(", ", req.GestorIds);
        if (req.PeriodoInicio.HasValue)              filtros["Período de"] = req.PeriodoInicio.Value.ToString("dd/MM/yyyy");
        if (req.PeriodoFim.HasValue)                 filtros["Período até"] = req.PeriodoFim.Value.ToString("dd/MM/yyyy");

        var cols = new[] { "GESTOR", "USUÁRIO", "LOTE", "DATA", "EQUIPAMENTOS", "TERMO", "FOTO" };
        var larg = new float[] { 3f, 2f, 3f, 1.8f, 1.5f, 1.5f, 1f };

        var linhas = rows.Select(r => new[]
        {
            r.Gestor, r.Matricula, r.LoteId, r.DataMovimentacao,
            r.QtdEquipamentos.ToString(), r.StatusTermo, r.ComFoto
        });

        var tots = new string[cols.Length];
        tots[0] = $"TOTAL LOTES: {rows.Count}";
        tots[4] = rows.Sum(r => r.QtdEquipamentos).ToString();
        for (int i = 0; i < cols.Length; i++) tots[i] ??= "";

        return GerarRelatorioTabular("TERMOS POR RESPONSÁVEL / PERÍODO", filtros, cols, larg, linhas, emissor, tots);
    }
}
