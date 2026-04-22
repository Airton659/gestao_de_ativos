using Dapper;
using GATI.API.Data;
using GATI.API.DTOs;
using System.Text.RegularExpressions;
using System.Linq;

namespace GATI.API.Services;

public class RelatorioService
{
    private readonly DbConnectionFactory _db;

    public RelatorioService(DbConnectionFactory db) => _db = db;

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Constrói placeholders "?,?,?" e adiciona os valores ao DynamicParameters
    private static string InPlaceholders<T>(List<T> values, DynamicParameters dp, string prefix)
    {
        var holders = new List<string>();
        for (int i = 0; i < values.Count; i++)
        {
            var key = $"{prefix}_{i}";
            dp.Add(key, values[i]);
            holders.Add("?");
        }
        return string.Join(",", holders);
    }

    // Helper para Ordenação Natural (Ex: Consultório 1, Consultório 2, Consultório 10)
    private static IEnumerable<T> NaturalSort<T>(IEnumerable<T> source, Func<T, string> keySelector)
    {
        return source.OrderBy(x => {
            var val = keySelector(x) ?? "";
            return System.Text.RegularExpressions.Regex.Replace(val, @"\d+", m => m.Value.PadLeft(12, '0'));
        }, StringComparer.OrdinalIgnoreCase);
    }

    // ── R01 — Inventário Geral ────────────────────────────────────────────────

    public async Task<(List<R01Row> Rows, R01Totais Totais)> GetInventario(R01InventarioRequest req)
    {
        using var conn = _db.Create();
        var where = new List<string>();
        var dp = new DynamicParameters();

        if (req.LocalizacaoIds?.Any() == true)
            where.Add($"e.localizacao_id IN ({InPlaceholders(req.LocalizacaoIds, dp, "lid")})");
        if (req.Tipos?.Any() == true)
            where.Add($"UPPER(e.tipo) IN ({InPlaceholders(req.Tipos.Select(t => t.ToUpper()).ToList(), dp, "tipo")})");
        if (req.Status?.Any() == true)
        {
            var flags = req.Status.Select(s => s.ToUpper() == "ATIVO" ? "1" : "0").Distinct().ToList();
            where.Add($"CAST(e.ativo AS VARCHAR) IN ({InPlaceholders(flags, dp, "st")})");
        }
        if (req.IsProprio?.Any() == true)
        {
            var flags = req.IsProprio.Select(b => b ? "1" : "0").Distinct().ToList();
            where.Add($"CAST(e.is_proprio AS VARCHAR) IN ({InPlaceholders(flags, dp, "ip")})");
        }
        if (req.EstadosConservacao?.Any() == true)
            where.Add($"UPPER(ISNULL(e.estado_conservacao,'')) IN ({InPlaceholders(req.EstadosConservacao.Select(x => x.ToUpper()).ToList(), dp, "ec")})");
        if (req.DataAquisicaoInicio.HasValue) { where.Add("e.data_aquisicao >= ?"); dp.Add("dai", req.DataAquisicaoInicio.Value); }
        if (req.DataAquisicaoFim.HasValue)    { where.Add("e.data_aquisicao <= ?"); dp.Add("daf", req.DataAquisicaoFim.Value); }
        if (req.FornecedorIds?.Any() == true)
            where.Add($"e.fornecedor_id IN ({InPlaceholders(req.FornecedorIds, dp, "fid")})");

        var wClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var sql = $@"
            SELECT
                ISNULL(NULLIF(e.numero_patrimonio,''), CAST(e.id AS VARCHAR)) AS NumeroPatrimonio,
                e.tipo AS Tipo,
                LTRIM(RTRIM(ISNULL(e.marca,'') + ' ' + ISNULL(e.modelo,''))) AS MarcaModelo,
                ISNULL(e.numero_serie,'—') AS NumeroSerie,
                CASE WHEN e.ativo = 1 THEN 'ATIVO' ELSE 'INATIVO' END AS Status,
                ISNULL(e.estado_conservacao,'—') AS EstadoConservacao,
                CASE WHEN e.is_proprio = 1 THEN 'Próprio' ELSE 'Terceiros' END AS Propriedade,
                ISNULL(CONVERT(VARCHAR,e.data_aquisicao,103),'—') AS DataAquisicao,
                ISNULL('R$ ' + REPLACE(CONVERT(VARCHAR,CAST(e.valor AS DECIMAL(15,2))),'.00',''),'-') AS Valor,
                ISNULL(e.valor,0) AS ValorNumerico,
                LTRIM(RTRIM(ISNULL(l.campus,'') + ISNULL(' / '+l.bloco,'') + ' / ' + ISNULL(l.sala,''))) AS Localizacao,
                ISNULL(f.nome_empresa,'—') AS Fornecedor,
                ISNULL(u.nome,'—') AS Responsavel
            FROM equipamento e
            LEFT JOIN localizacao l ON e.localizacao_id = l.id
            LEFT JOIN fornecedor f ON e.fornecedor_id = f.id
            LEFT JOIN usuario u ON e.responsavel_id = u.id
            {wClause}
            ORDER BY l.campus, l.bloco, l.sala, e.tipo";

        var totSql = $@"
            SELECT COUNT(*) AS Total,
                   SUM(CASE WHEN e.ativo=1 THEN 1 ELSE 0 END) AS Ativos,
                   SUM(CASE WHEN e.ativo=0 THEN 1 ELSE 0 END) AS Inativos,
                   ISNULL(SUM(e.valor),0) AS ValorTotal
            FROM equipamento e
            LEFT JOIN localizacao l ON e.localizacao_id = l.id
            LEFT JOIN fornecedor f ON e.fornecedor_id = f.id
            LEFT JOIN usuario u ON e.responsavel_id = u.id
            {wClause}";

        var rows   = (await conn.QueryAsync<R01Row>(sql, dp)).ToList();
        var totais = await conn.QueryFirstAsync<R01Totais>(totSql, dp);
        return (NaturalSort(rows, r => r.Localizacao).ToList(), totais);
    }

    // ── R02 — Por Localização ─────────────────────────────────────────────────

    public async Task<List<R02Row>> GetPorLocalizacao(R02LocalizacaoRequest req)
    {
        using var conn = _db.Create();
        var dp = new DynamicParameters();

        // 1. Filtros de Equipamento (Vão no JOIN, então vêm PRIMEIRO na ordem do ODBC se o JOIN estiver no topo)
        var whereE = new List<string>();
        if (req.Tipos?.Any() == true)
            whereE.Add($"UPPER(e.tipo) IN ({InPlaceholders(req.Tipos.Select(x => x.ToUpper()).ToList(), dp, "tipo")})");

        // 2. Filtros de Localização (Vão na cláusula WHERE, vêm depois dos parâmetros do JOIN)
        var whereL = new List<string> { "l.ativo = 1" };
        if (req.Campus?.Any() == true)
            whereL.Add($"UPPER(l.campus) IN ({InPlaceholders(req.Campus.Select(x => x.ToUpper()).ToList(), dp, "camp")})");
        if (req.Blocos?.Any() == true)
            whereL.Add($"UPPER(ISNULL(l.bloco,'')) IN ({InPlaceholders(req.Blocos.Select(x => x.ToUpper()).ToList(), dp, "bloco")})");

        var eJoinFilter = whereE.Count > 0 ? "AND " + string.Join(" AND ", whereE) : "";
        var lWhere = "WHERE " + string.Join(" AND ", whereL);
        var having = req.IncluirSalasVazias ? "" : "HAVING COUNT(e.id) > 0";

        // Usamos STRING_AGG (compatível com SQL Server 2017+)
        var sql = $@"
            SELECT
                l.campus AS Campus,
                ISNULL(l.bloco,'—') AS Bloco,
                l.sala AS Sala,
                COUNT(e.id) AS TotalEquipamentos,
                SUM(CASE WHEN e.ativo=1 THEN 1 ELSE 0 END) AS Ativos,
                SUM(CASE WHEN e.ativo=0 THEN 1 ELSE 0 END) AS Inativos,
                ISNULL(STUFF((
                    SELECT DISTINCT ', ' + e2.tipo
                    FROM equipamento e2
                    WHERE e2.localizacao_id = l.id
                    FOR XML PATH('')
                ), 1, 2, ''), '—') AS Tipos
            FROM localizacao l
            LEFT JOIN equipamento e ON e.localizacao_id = l.id {eJoinFilter}
            {lWhere}
            GROUP BY l.campus, l.bloco, l.sala, l.id
            {having}
            ORDER BY l.campus, l.bloco, l.sala";

        var result = (await conn.QueryAsync<R02Row>(sql, dp)).ToList();
        return NaturalSort(result, r => $"{r.Campus} {r.Bloco} {r.Sala}").ToList();
    }

    // ── R03 — Histórico de Movimentações ──────────────────────────────────────

    public async Task<List<R03Row>> GetHistorico(R03HistoricoRequest req)
    {
        using var conn = _db.Create();
        var where = new List<string>
        {
            "m.data_movimentacao >= ?",
            "m.data_movimentacao <= ?"
        };
        var dp = new DynamicParameters();
        dp.Add("di", req.PeriodoInicio);
        dp.Add("df", req.PeriodoFim.Date.AddDays(1).AddSeconds(-1));

        if (req.EquipamentoIds?.Any() == true)
            where.Add($"m.equipamento_id IN ({InPlaceholders(req.EquipamentoIds, dp, "eid")})");
        if (req.TecnicoIds?.Any() == true)
            where.Add($"m.tecnico_id IN ({InPlaceholders(req.TecnicoIds, dp, "tid")})");
        if (req.OrigemIds?.Any() == true)
            where.Add($"m.loc_origem_id IN ({InPlaceholders(req.OrigemIds, dp, "oid")})");
        if (req.DestinoIds?.Any() == true)
            where.Add($"m.loc_destino_id IN ({InPlaceholders(req.DestinoIds, dp, "did")})");

        var wClause = "WHERE " + string.Join(" AND ", where);

        var sql = $@"
            SELECT
                CONVERT(VARCHAR, m.data_movimentacao, 103) + ' ' + CONVERT(VARCHAR, m.data_movimentacao, 108) AS DataMovimentacao,
                ISNULL(NULLIF(f.sigla+' - ',' - '),'') + ISNULL(NULLIF(e.numero_patrimonio,''), CAST(e.id AS VARCHAR)) AS Patrimonio,
                ISNULL(e.tipo,'—') AS Tipo,
                ISNULL(ut.nome,'—') AS Tecnico,
                ISNULL(ur.nome,'—') AS Gestor,
                LTRIM(RTRIM(ISNULL(lo.bloco,'')+' '+ISNULL(lo.sala,''))) AS Origem,
                LTRIM(RTRIM(ISNULL(ld.bloco,'')+' '+ISNULL(ld.sala,''))) AS Destino,
                ISNULL(m.motivo,'—') AS Motivo,
                CASE WHEN m.termo_pdf_url IS NOT NULL THEN 'Sim' ELSE 'Não' END AS ComTermo
            FROM movimentacao m
            JOIN equipamento e ON m.equipamento_id = e.id
            LEFT JOIN fornecedor f ON e.fornecedor_id = f.id
            LEFT JOIN localizacao lo ON m.loc_origem_id = lo.id
            LEFT JOIN localizacao ld ON m.loc_destino_id = ld.id
            LEFT JOIN usuario ut ON m.tecnico_id = ut.id
            LEFT JOIN usuario ur ON m.recebedor_id = ur.id
            {wClause}
            ORDER BY m.data_movimentacao DESC";

        return (await conn.QueryAsync<R03Row>(sql, dp)).ToList();
    }

    // ── R04 — Por Responsável ─────────────────────────────────────────────────

    public async Task<List<R04Row>> GetPorResponsavel(R04ResponsavelRequest req)
    {
        using var conn = _db.Create();
        var where = new List<string> { "e.ativo = 1" };
        var dp = new DynamicParameters();

        if (req.ResponsavelIds?.Any() == true)
            where.Add($"e.responsavel_id IN ({InPlaceholders(req.ResponsavelIds, dp, "rid")})");
        if (req.Tipos?.Any() == true)
            where.Add($"UPPER(e.tipo) IN ({InPlaceholders(req.Tipos.Select(x => x.ToUpper()).ToList(), dp, "tipo")})");
        if (req.ValorMinimo.HasValue) { where.Add("e.valor >= ?"); dp.Add("vm", req.ValorMinimo.Value); }

        var wClause = "WHERE " + string.Join(" AND ", where);

        var sql = $@"
            SELECT
                ISNULL(u.nome,'Sem Responsável') AS Responsavel,
                ISNULL(u.matricula,'—') AS Matricula,
                e.tipo AS Tipo,
                COUNT(*) AS Quantidade,
                ISNULL(SUM(e.valor),0) AS ValorTotal
            FROM equipamento e
            LEFT JOIN usuario u ON e.responsavel_id = u.id
            {wClause}
            GROUP BY u.id, u.nome, u.matricula, e.tipo
            ORDER BY u.nome, e.tipo";

        return (await conn.QueryAsync<R04Row>(sql, dp)).ToList();
    }

    // ── R05 — Manutenção / Depreciados ────────────────────────────────────────

    public async Task<List<R05Row>> GetManutencao(R05ManutencaoRequest req)
    {
        using var conn = _db.Create();
        // R05 agora foca exclusivamente em INATIVOS
        var where = new List<string> { "e.ativo = 0" };
        var dp = new DynamicParameters();

        if (req.EstadosConservacao?.Any() == true)
            where.Add($"UPPER(ISNULL(e.estado_conservacao,'')) IN ({InPlaceholders(req.EstadosConservacao.Select(x => x.ToUpper()).ToList(), dp, "ec")})");
        if (req.AnosMinimos.HasValue) { where.Add("DATEDIFF(YEAR, e.data_aquisicao, GETDATE()) >= ?"); dp.Add("anos", req.AnosMinimos.Value); }
        if (req.Tipos?.Any() == true)
            where.Add($"UPPER(e.tipo) IN ({InPlaceholders(req.Tipos.Select(x => x.ToUpper()).ToList(), dp, "tipo")})");
        if (req.LocalizacaoIds?.Any() == true)
            where.Add($"e.localizacao_id IN ({InPlaceholders(req.LocalizacaoIds, dp, "lid")})");

        var wClause = "WHERE " + string.Join(" AND ", where);

        var sql = $@"
            SELECT
                ISNULL(NULLIF(e.numero_patrimonio,''), CAST(e.id AS VARCHAR)) AS NumeroPatrimonio,
                e.tipo AS Tipo,
                LTRIM(RTRIM(ISNULL(e.marca,'') + ' ' + ISNULL(e.modelo,''))) AS MarcaModelo,
                ISNULL(e.estado_conservacao,'—') AS EstadoConservacao,
                ISNULL(CONVERT(VARCHAR,e.data_aquisicao,103),'—') AS DataAquisicao,
                ISNULL(DATEDIFF(YEAR, e.data_aquisicao, GETDATE()), 0) AS AnosUso,
                CASE WHEN e.ativo = 1 THEN 'ATIVO' ELSE 'INATIVO' END AS Status,
                LTRIM(RTRIM(ISNULL(l.campus,'') + ISNULL(' / '+l.bloco,'') + ' / ' + ISNULL(l.sala,''))) AS Localizacao,
                ISNULL(u.nome,'—') AS Responsavel,
                ISNULL(e.observacoes,'—') AS Observacoes
            FROM equipamento e
            LEFT JOIN localizacao l ON e.localizacao_id = l.id
            LEFT JOIN usuario u ON e.responsavel_id = u.id
            {wClause}
            ORDER BY l.campus, l.bloco, l.sala, e.tipo";

        var result = (await conn.QueryAsync<R05Row>(sql, dp)).ToList();
        return NaturalSort(result, r => r.Localizacao).ToList();
    }

    // ── R06 — Termos por Responsável/Período ──────────────────────────────────

    public async Task<List<R06Row>> GetTermos(R06TermosRequest req)
    {
        using var conn = _db.Create();
        var where = new List<string> { "m.lote_id IS NOT NULL" };
        var dp = new DynamicParameters();

        if (req.GestorIds?.Any() == true)
            where.Add($"m.recebedor_id IN ({InPlaceholders(req.GestorIds, dp, "gid")})");
        if (req.PeriodoInicio.HasValue) { where.Add("m.data_movimentacao >= ?"); dp.Add("di", req.PeriodoInicio.Value); }
        if (req.PeriodoFim.HasValue)    { where.Add("m.data_movimentacao <= ?"); dp.Add("df", req.PeriodoFim.Value.Date.AddDays(1).AddSeconds(-1)); }

        var wClause = "WHERE " + string.Join(" AND ", where);

        var sql = $@"
            SELECT
                ISNULL(ur.nome,'—') AS Gestor,
                ISNULL(ur.matricula,'—') AS Matricula,
                m.lote_id AS LoteId,
                CONVERT(VARCHAR, m.data_movimentacao, 103) AS DataMovimentacao,
                COUNT(*) AS QtdEquipamentos,
                CASE WHEN MAX(CASE WHEN m.termo_pdf_url IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'Assinado' ELSE 'Pendente' END AS StatusTermo,
                CASE WHEN MAX(CASE WHEN m.foto_assinatura_url IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 'Sim' ELSE 'Não' END AS ComFoto
            FROM movimentacao m
            JOIN usuario ur ON m.recebedor_id = ur.id
            {wClause}
            GROUP BY ur.nome, ur.matricula, m.lote_id, CONVERT(VARCHAR, m.data_movimentacao, 103)
            ORDER BY MAX(m.data_movimentacao) DESC, ur.nome";

        return (await conn.QueryAsync<R06Row>(sql, dp)).ToList();
    }
}
