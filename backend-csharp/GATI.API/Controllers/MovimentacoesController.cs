using Microsoft.AspNetCore.Mvc;
using Dapper;
using GATI.API.Data;
using GATI.API.Models;
using GATI.API.Middleware;
using GATI.API.Services;
using GATI.API.DTOs;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;
using System.Linq;
using System.Collections.Generic;

namespace GATI.API.Controllers;

[Route("api/v1/movimentacoes")]
[ApiController]
public class MovimentacoesController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly PdfService _pdfService;
    private readonly AuthService _authService;
    private readonly EmailService _emailService;
    private readonly AuditService _auditService;
    private readonly IMemoryCache _cache;
    private const string CachePrefix = "movs_";
    private static System.Threading.CancellationTokenSource _resetCacheToken = new();

    public MovimentacoesController(IDbConnectionFactory db, PdfService pdfService, AuthService authService, EmailService emailService, AuditService auditService, IMemoryCache cache)
    {
        _db = db;
        _pdfService = pdfService;
        _authService = authService;
        _emailService = emailService;
        _auditService = auditService;
        _cache = cache;
    }

    [HttpGet]
    [RequirePermission("movimentacoes:ler")]
    public async Task<IActionResult> GetMovimentacoes(
        [FromQuery] int skip = 0,
        [FromQuery] int limit = 100,
        [FromQuery] int? equipamento_id = null,
        [FromQuery] int? loc_origem_id = null,
        [FromQuery] int? loc_destino_id = null,
        [FromQuery] int? tecnico_id = null)
    {
        var cacheKey = $"{CachePrefix}{skip}_{limit}_{equipamento_id}_{loc_origem_id}_{loc_destino_id}_{tecnico_id}";

        if (_cache.TryGetValue(cacheKey, out IActionResult? cached))
            return cached!;

        return await _cache.GetOrCreateAsync<IActionResult>(cacheKey, async entry =>
        {
            entry.AddExpirationToken(new CancellationChangeToken(_resetCacheToken.Token));
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            using var conn = _db.Create();
            
            var where = new List<string>();
            var dp = new DynamicParameters();

            if (equipamento_id.HasValue) { where.Add("m.equipamento_id = ?"); dp.Add("p1", equipamento_id); }
            if (loc_origem_id.HasValue) { where.Add("m.loc_origem_id = ?"); dp.Add("p2", loc_origem_id); }
            if (loc_destino_id.HasValue) { where.Add("m.loc_destino_id = ?"); dp.Add("p3", loc_destino_id); }
            if (tecnico_id.HasValue) { where.Add("m.tecnico_id = ?"); dp.Add("p4", tecnico_id); }

            var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

            var sql = $@"
                SELECT TOP {limit}
                    m.id, m.data_movimentacao, m.equipamento_id, m.loc_origem_id, m.loc_destino_id, 
                    m.tecnico_id, m.recebedor_id, m.motivo, m.lote_id, m.termo_pdf_url, m.foto_assinatura_url,
                    ISNULL(NULLIF(f.sigla + ' - ', ' - '), '') + ISNULL(NULLIF(e.numero_patrimonio, ''), CAST(e.id AS VARCHAR)) AS equipamento_patrimonio, 
                    ut.nome AS tecnico_nome, ur.nome AS recebedor_nome,
                    LTRIM(RTRIM(ISNULL(lo.bloco, '') + ' ' + ISNULL(lo.sala, ''))) AS loc_origem_dsc,
                    LTRIM(RTRIM(ISNULL(ld.bloco, '') + ' ' + ISNULL(ld.sala, ''))) AS loc_destino_dsc,
                    e.marca, e.modelo, e.numero_serie, e.tipo, e.is_proprio, e.estado_conservacao, 
                    CASE WHEN e.ativo = 1 THEN 'ATIVO' ELSE 'INATIVO' END AS equipamento_status, 
                    f.nome_empresa AS fornecedor_nome, f.sigla AS fornecedor_sigla
                FROM movimentacao m
                LEFT JOIN equipamento e ON m.equipamento_id = e.id
                LEFT JOIN fornecedor f ON e.fornecedor_id = f.id
                LEFT JOIN localizacao lo ON m.loc_origem_id = lo.id
                LEFT JOIN localizacao ld ON m.loc_destino_id = ld.id
                LEFT JOIN usuario ut ON m.tecnico_id = ut.id
                LEFT JOIN usuario ur ON m.recebedor_id = ur.id
                {whereClause}
                ORDER BY m.data_movimentacao DESC";

            try {
                if (conn.State != System.Data.ConnectionState.Open)
                    ((System.Data.Common.DbConnection)conn).Open();

                var movs = await conn.QueryAsync(sql, dp);
                return Ok(movs);
            } catch (Exception ex) {
                return StatusCode(500, new { detail = $"Erro ao buscar movimentações: {ex.Message}" });
            }
        }) ?? StatusCode(500);
    }

    [HttpGet("tipos")]
    [RequirePermission("movimentacoes:ler")]
    public async Task<IActionResult> GetTipos()
    {
        using var conn = _db.Create();
        try {
            if (conn.State != System.Data.ConnectionState.Open)
                ((System.Data.Common.DbConnection)conn).Open();

            var tipos = await conn.QueryAsync<string>(
                "SELECT DISTINCT e.tipo FROM movimentacao m LEFT JOIN equipamento e ON m.equipamento_id = e.id WHERE e.tipo IS NOT NULL AND LTRIM(RTRIM(e.tipo)) <> '' ORDER BY e.tipo");

            return Ok(tipos.ToList());
        } catch (Exception ex) {
            _ = ex;
            return StatusCode(500, new { detail = "Erro ao buscar tipos." });
        }
    }

    [HttpGet("paginated")]
    [RequirePermission("movimentacoes:ler")]
    public async Task<IActionResult> GetPaginated(
        [FromQuery] int page = 1,
        [FromQuery] int page_size = 25,
        [FromQuery] string? search = null,
        [FromQuery(Name = "tipos")] List<string>? tipos = null,
        [FromQuery] string? origem = null,
        [FromQuery] string? destino = null,
        [FromQuery] string? gestor = null,
        [FromQuery] string? tecnico = null,
        [FromQuery] string? data_de = null,
        [FromQuery] string? data_ate = null)
    {
        using var conn = _db.Create();
        try {
            if (conn.State != System.Data.ConnectionState.Open)
                ((System.Data.Common.DbConnection)conn).Open();

            var where = new List<string>();
            var dp = new DynamicParameters();
            int pIdx = 1;

            if (!string.IsNullOrWhiteSpace(search)) {
                var s = $"%{search}%";
                where.Add(@"(e.numero_patrimonio LIKE ? OR e.tipo LIKE ? OR e.marca LIKE ? OR e.modelo LIKE ?
                    OR e.numero_serie LIKE ? OR f.sigla LIKE ? OR ut.nome LIKE ? OR ur.nome LIKE ?
                    OR lo.bloco LIKE ? OR lo.sala LIKE ? OR lo.campus LIKE ?
                    OR ld.bloco LIKE ? OR ld.sala LIKE ? OR ld.campus LIKE ?)");
                for (int i = 0; i < 14; i++) dp.Add("p" + (pIdx++), s);
            }

            if (tipos != null && tipos.Count > 0) {
                var placeholders = string.Join(",", tipos.Select(_ => "?"));
                where.Add($"e.tipo IN ({placeholders})");
                foreach (var t in tipos) dp.Add("p" + (pIdx++), t);
            }

            if (!string.IsNullOrWhiteSpace(origem)) {
                var s = $"%{origem}%";
                where.Add("(lo.campus LIKE ? OR lo.bloco LIKE ? OR lo.sala LIKE ?)");
                dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s);
            }

            if (!string.IsNullOrWhiteSpace(destino)) {
                var s = $"%{destino}%";
                where.Add("(ld.campus LIKE ? OR ld.bloco LIKE ? OR ld.sala LIKE ?)");
                dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s);
            }

            if (!string.IsNullOrWhiteSpace(gestor)) {
                where.Add("ur.nome LIKE ?");
                dp.Add("p" + (pIdx++), $"%{gestor}%");
            }

            if (!string.IsNullOrWhiteSpace(tecnico)) {
                where.Add("ut.nome LIKE ?");
                dp.Add("p" + (pIdx++), $"%{tecnico}%");
            }

            if (!string.IsNullOrWhiteSpace(data_de)) {
                where.Add("m.data_movimentacao >= ?");
                dp.Add("p" + (pIdx++), data_de);
            }

            if (!string.IsNullOrWhiteSpace(data_ate)) {
                where.Add("m.data_movimentacao <= ?");
                dp.Add("p" + (pIdx++), data_ate);
            }

            var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
            var skip = (page - 1) * page_size;

            const string FromMovJoints = @"FROM movimentacao m
                LEFT JOIN equipamento e ON m.equipamento_id = e.id
                LEFT JOIN fornecedor f ON e.fornecedor_id = f.id
                LEFT JOIN localizacao lo ON m.loc_origem_id = lo.id
                LEFT JOIN localizacao ld ON m.loc_destino_id = ld.id
                LEFT JOIN usuario ut ON m.tecnico_id = ut.id
                LEFT JOIN usuario ur ON m.recebedor_id = ur.id";

            const string MovSelectCols = @"m.id, m.data_movimentacao, m.equipamento_id, m.loc_origem_id, m.loc_destino_id,
                m.tecnico_id, m.recebedor_id, m.motivo, m.lote_id, m.termo_pdf_url, m.foto_assinatura_url,
                ISNULL(NULLIF(f.sigla + ' - ', ' - '), '') + ISNULL(NULLIF(e.numero_patrimonio, ''), CAST(e.id AS VARCHAR)) AS equipamento_patrimonio,
                ut.nome AS tecnico_nome, ur.nome AS recebedor_nome,
                LTRIM(RTRIM(ISNULL(lo.bloco, '') + ' ' + ISNULL(lo.sala, ''))) AS loc_origem_dsc,
                LTRIM(RTRIM(ISNULL(ld.bloco, '') + ' ' + ISNULL(ld.sala, ''))) AS loc_destino_dsc,
                e.marca, e.modelo, e.numero_serie, e.tipo, e.is_proprio, e.estado_conservacao,
                CASE WHEN e.ativo = 1 THEN 'ATIVO' ELSE 'INATIVO' END AS equipamento_status,
                f.nome_empresa AS fornecedor_nome, f.sigla AS fornecedor_sigla";

            var countSql = $"SELECT COUNT(*) {FromMovJoints} {whereClause}";
            var total = await conn.ExecuteScalarAsync<int>(countSql, dp);

            var itemsSql = $@"
                SELECT * FROM (
                    SELECT {MovSelectCols}, ROW_NUMBER() OVER (ORDER BY m.data_movimentacao DESC) as row_num
                    {FromMovJoints}
                    {whereClause}
                ) AS t
                WHERE t.row_num > {skip} AND t.row_num <= {skip + page_size}
                ORDER BY t.row_num";

            var movs = await conn.QueryAsync(itemsSql, dp);
            var items = movs.ToList();

            return Ok(new { items, total, page, page_size });
        } catch (Exception ex) {
            return StatusCode(500, new { detail = $"Erro ao buscar histórico: {ex.Message}" });
        }
    }

    private void ClearMovimentacoesCache()
    {
        var oldToken = _resetCacheToken;
        _resetCacheToken = new System.Threading.CancellationTokenSource();
        oldToken.Cancel();
        oldToken.Dispose();
    }

    [HttpGet("minhas")]
    [RequirePermission("movimentacoes:ler")]
    public async Task<IActionResult> GetMinhasMovimentacoes()
    {
        try
        {
            var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
            var userId = int.Parse(userIdStr);

            using var conn = _db.Create();

            // Busca os contadores totais para estatísticas, ignorando o limite visual
            var totalTecnico = (int)await conn.ExecuteScalarAsync<long>(
                "SELECT COUNT(*) FROM movimentacao WHERE tecnico_id = ?", new { p1 = userId });
            
            var totalGestor = (int)await conn.ExecuteScalarAsync<long>(
                "SELECT COUNT(*) FROM movimentacao WHERE recebedor_id = ?", new { p1 = userId });
            
            var totalRegistros = (int)await conn.ExecuteScalarAsync<long>(
                "SELECT COUNT(*) FROM movimentacao WHERE tecnico_id = ? OR recebedor_id = ?", 
                new { p1 = userId, p2 = userId });

            // Busca apenas as últimas 20 para exibição na lista
            var movs = (await conn.QueryAsync<Movimentacao>(
                "SELECT TOP 20 * FROM movimentacao WHERE tecnico_id = ? OR recebedor_id = ? ORDER BY data_movimentacao DESC",
                new { p1 = userId, p2 = userId })).ToList();

            foreach (var m in movs)
            {
                m.Equipamento = await conn.QueryFirstOrDefaultAsync<Equipamento>(
                    "SELECT id, numero_patrimonio, nome, numero_serie, tipo, marca, modelo, data_aquisicao, valor, estado_conservacao, especificacoes AS EspecificacoesJson, fotos AS FotosJson, ativo, is_proprio, observacoes, localizacao_id, responsavel_id, fornecedor_id FROM equipamento WHERE id = ?",
                    new { p1 = m.EquipamentoId });
                m.Tecnico = await conn.QueryFirstOrDefaultAsync<Usuario>(
                    "SELECT * FROM usuario WHERE id = ?", new { p1 = m.TecnicoId });
            }

            return Ok(new {
                total_tecnico = totalTecnico,
                total_gestor = totalGestor,
                total_registros = totalRegistros,
                movimentacoes = movs
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = $"Erro ao buscar estatísticas: {ex.Message}" });
        }
    }

    [HttpPost]
    [RequirePermission("movimentacoes:criar")]
    public async Task<ActionResult<Movimentacao>> CreateMovimentacao(MovimentacaoCreate req)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        var userId = int.Parse(userIdStr);

        using var conn = _db.Create();

        // Busca o ID do recebedor pela matrícula
        var recebedor = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT id FROM usuario WHERE matricula = ?", new { username = req.gestor_matricula });

        if (recebedor == null) return BadRequest("Gestor/Recebedor não encontrado");

        var equip = await conn.QueryFirstOrDefaultAsync<Equipamento>(
            "SELECT * FROM equipamento WHERE id = ?", new { id = req.equipamento_id });
        
        if (equip == null) return BadRequest("Equipamento não encontrado");

        var mov = new Movimentacao
        {
            EquipamentoId = req.equipamento_id,
            TecnicoId = userId,
            LocOrigemId = req.loc_origem_id,
            LocDestinoId = req.loc_destino_id,
            ResponsavelAnteriorId = equip.ResponsavelId,
            ResponsavelNovoId = recebedor.Id,
            RecebedorId = recebedor.Id,
            Motivo = req.motivo ?? "Movimentação via sistema",
            DataMovimentacao = Movimentacao.BrasiliaNow(),
            LoteId = req.lote_id
        };

        var sql = @"INSERT INTO movimentacao (equipamento_id, tecnico_id, loc_origem_id, loc_destino_id,
                      responsavel_anterior_id, responsavel_novo_id, recebedor_id, motivo,
                      data_movimentacao, lote_id)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                      SELECT CAST(SCOPE_IDENTITY() AS int)";

        mov.Id = await conn.ExecuteScalarAsync<int>(sql, new { 
            mov.EquipamentoId, mov.TecnicoId, mov.LocOrigemId, mov.LocDestinoId,
            mov.ResponsavelAnteriorId, mov.ResponsavelNovoId, mov.RecebedorId,
            mov.Motivo, mov.DataMovimentacao, mov.LoteId 
        });

        await conn.ExecuteAsync(
            "UPDATE equipamento SET localizacao_id = ?, responsavel_id = ? WHERE id = ?",
            new { mov.LocDestinoId, mov.ResponsavelNovoId, mov.EquipamentoId });

        await _auditService.RegistrarLog(userId, "CRIAR", "movimentacao", mov.Id, null,
            new {
                mov.Id, mov.EquipamentoId, mov.TecnicoId, mov.RecebedorId,
                mov.LocOrigemId, mov.LocDestinoId, mov.Motivo, mov.DataMovimentacao, mov.LoteId
            },
            HttpContext.Connection.RemoteIpAddress?.ToString());

        _cache.Remove(DashboardController.CacheKey);
        ClearMovimentacoesCache();
        return CreatedAtAction(nameof(GetMovimentacoes), new { id = mov.Id }, mov);
    }

    [HttpPost("troca-responsabilidade")]
    [RequirePermission("movimentacoes:trocar-responsabilidade")]
    public async Task<IActionResult> TrocaResponsabilidade([FromBody] TrocaResponsabilidadeRequest req)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdStr)) return Unauthorized();
        var userId = int.Parse(userIdStr);

        using var conn = _db.Create();

        // 1. Validar e buscar recebedor
        var recebedor = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE matricula = ?", new { username = req.gestor_matricula });

        if (recebedor == null) return BadRequest(new { detail = "Novo gestor não encontrado." });
        if (string.IsNullOrEmpty(recebedor.SenhaHash) || !_authService.VerifyPassword(req.senha_confirmacao, recebedor.SenhaHash))
            return BadRequest(new { detail = "Senha de confirmação inválida para o gestor selecionado." });

        if (string.IsNullOrEmpty(recebedor.AssinaturaUrl))
            return BadRequest(new { detail = "O usuário selecionado não possui assinatura cadastrada em seu perfil." });

        // 2. Validar equipamento
        var equip = await conn.QueryFirstOrDefaultAsync<Equipamento>(
            "SELECT * FROM equipamento WHERE id = ?", new { id = req.equipamento_id });
        
        if (equip == null) return BadRequest(new { detail = "Equipamento não encontrado." });
        if (!equip.LocalizacaoId.HasValue) return BadRequest(new { detail = "Equipamento não possui localização definida. Defina onde ele está primeiro." });
        
        if (equip.ResponsavelId == recebedor.Id) return BadRequest(new { detail = "O usuário selecionado já é o responsável atual." });

        // 3. Criar Movimentação "Virtual"
        var mov = new Movimentacao
        {
            EquipamentoId = req.equipamento_id,
            TecnicoId = userId,
            LocOrigemId = equip.LocalizacaoId, 
            LocDestinoId = equip.LocalizacaoId,
            ResponsavelAnteriorId = equip.ResponsavelId,
            ResponsavelNovoId = recebedor.Id,
            RecebedorId = recebedor.Id,
            Motivo = !string.IsNullOrWhiteSpace(req.motivo) ? req.motivo : "Troca de Responsabilidade",
            DataMovimentacao = Movimentacao.BrasiliaNow(),
            LoteId = "TR" + Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper() 
        };

        var sqlInsert = @"INSERT INTO movimentacao (equipamento_id, tecnico_id, loc_origem_id, loc_destino_id,
                      responsavel_anterior_id, responsavel_novo_id, recebedor_id, motivo,
                      data_movimentacao, lote_id)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                      SELECT CAST(SCOPE_IDENTITY() AS int)";

        mov.Id = await conn.ExecuteScalarAsync<int>(sqlInsert, new { 
            mov.EquipamentoId, mov.TecnicoId, mov.LocOrigemId, mov.LocDestinoId,
            mov.ResponsavelAnteriorId, mov.ResponsavelNovoId, mov.RecebedorId,
            mov.Motivo, mov.DataMovimentacao, mov.LoteId
        });

        // 4. Atualizar somente o responsável no equipamento
        await conn.ExecuteAsync(
            "UPDATE equipamento SET responsavel_id = ? WHERE id = ?",
            new { mov.ResponsavelNovoId, mov.EquipamentoId });

        // 5. Auditoria (inclusive repassa o nome no Tipo p/ auditoria explícita)
        await _auditService.RegistrarLog(userId, "CRIAR", "movimentacao", mov.Id, null,
            new {
                Tipo = "Troca de Responsabilidade",
                mov.Id, mov.EquipamentoId, mov.TecnicoId, mov.RecebedorId,
                mov.LocOrigemId, mov.LocDestinoId, mov.Motivo, mov.DataMovimentacao
            },
            HttpContext.Connection.RemoteIpAddress?.ToString());

        // 6. Salvar Foto na Movimentação (Base64 NText handles)
        var fotoAUsar = !string.IsNullOrEmpty(req.foto_base64) ? req.foto_base64 : recebedor.AssinaturaUrl;
        
        if (conn is System.Data.Odbc.OdbcConnection odbcConn)
        {
            if (odbcConn.State != System.Data.ConnectionState.Open) odbcConn.Open();
            using var cmd = odbcConn.CreateCommand();
            cmd.CommandText = "UPDATE movimentacao SET foto_assinatura_url = ? WHERE id = ?";
            
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.NText) { Value = fotoAUsar });
            cmd.Parameters.Add(new System.Data.Odbc.OdbcParameter("@p3", System.Data.Odbc.OdbcType.Int) { Value = mov.Id });
            
            await cmd.ExecuteNonQueryAsync();
        }
        else 
        {
            await conn.ExecuteAsync(
                "UPDATE movimentacao SET foto_assinatura_url = ? WHERE id = ?",
                new { foto_assinatura_url = fotoAUsar, mov.Id });
        }

        _cache.Remove(DashboardController.CacheKey);
        ClearMovimentacoesCache();

        return Ok(new { success = true, movimentacaoId = mov.Id, loteId = mov.LoteId });
    }

    [HttpPost("gerar-termo")]
    [RequirePermission("movimentacoes:ler")]
    public async Task<IActionResult> GerarTermo([FromBody] int movimentacaoId)
    {
        using var conn = _db.Create();

        var mov = await conn.QueryFirstOrDefaultAsync<Movimentacao>(
            "SELECT * FROM movimentacao WHERE id = ?", new { movimentacaoId });

        if (mov == null) return NotFound();

        mov.Equipamento = await conn.QueryFirstOrDefaultAsync<Equipamento>(
            "SELECT id, numero_patrimonio, nome, numero_serie, tipo, marca, modelo, data_aquisicao, valor, estado_conservacao, especificacoes AS EspecificacoesJson, fotos AS FotosJson, ativo, is_proprio, observacoes, localizacao_id, responsavel_id, fornecedor_id FROM equipamento WHERE id = ?",
            new { mov.EquipamentoId });
        mov.Tecnico = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { mov.TecnicoId });
        if (mov.ResponsavelNovoId.HasValue)
            mov.ResponsavelNovo = await conn.QueryFirstOrDefaultAsync<Usuario>(
                "SELECT * FROM usuario WHERE id = ?", new { mov.ResponsavelNovoId });

        var pdf = _pdfService.GenerateMovimentacaoPdf(mov);
        return File(pdf, "application/pdf", $"termo_{movimentacaoId}.pdf");
    }

    [HttpPost("verificar-senha/")]
    public async Task<IActionResult> VerificarSenha([FromBody] ValidarSenhaGestorRequest req)
    {
        using var conn = _db.Create();
        var matricula = req.gestor_matricula?.Trim();
        var user = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE matricula = ?", new { username = matricula });

        bool userFound = user != null;
        bool hasHash = !string.IsNullOrEmpty(user?.SenhaHash);
        int passLen = req.senha_confirmacao?.Length ?? 0;
        int hashLen = user?.SenhaHash?.Length ?? 0;
        string hashPrefix = hasHash ? user!.SenhaHash.Substring(0, Math.Min(10, hashLen)) : "N/A";

        if (!userFound || !hasHash || !_authService.VerifyPassword(req.senha_confirmacao ?? "", user!.SenhaHash))
        {
            return BadRequest(new { detail = "Senha de confirmação inválida para o gestor selecionado." });
        }

        return Ok(new { valid = true });
    }

    [HttpPost("foto-confirmacao/{loteId}")]
    public async Task<IActionResult> UploadFotoConfirmacao(string loteId, IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("Arquivo inválido");

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var dataUri = $"data:{file.ContentType};base64,{Convert.ToBase64String(ms.ToArray())}";

        using var conn = _db.Create();
        if (conn is System.Data.Odbc.OdbcConnection odbcConn)
        {
            if (odbcConn.State != System.Data.ConnectionState.Open) odbcConn.Open();
            using var cmd = odbcConn.CreateCommand();
            cmd.CommandText = "UPDATE movimentacao SET foto_assinatura_url = ? WHERE LTRIM(RTRIM(lote_id)) = ?";
            
            var p1 = new System.Data.Odbc.OdbcParameter("@p1", System.Data.Odbc.OdbcType.NText) { Value = dataUri };
            var p2 = new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.VarChar) { Value = loteId.Trim() };
            
            cmd.Parameters.Add(p1);
            cmd.Parameters.Add(p2);

            await cmd.ExecuteNonQueryAsync();
        }
        else 
        {
            await conn.ExecuteAsync(
                "UPDATE movimentacao SET foto_assinatura_url = ? WHERE lote_id = ?",
                new { dataUri, loteId });
        }

        _cache.Remove(DashboardController.CacheKey);
        ClearMovimentacoesCache();
        return Ok(new { url = dataUri });
    }

    [HttpGet("foto-confirmacao/{loteId}")]
    public async Task<IActionResult> GetFotoConfirmacao(string loteId)
    {
        using var conn = _db.Create();
        var dataUri = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT TOP 1 foto_assinatura_url FROM movimentacao WHERE LTRIM(RTRIM(lote_id)) = ?", new { loteId });

        if (string.IsNullOrEmpty(dataUri)) return NotFound();

        var parts = dataUri.Split(',', 2);
        if (parts.Length != 2) return BadRequest();
        var mimeType = parts[0].Replace("data:", "").Replace(";base64", "");
        return File(Convert.FromBase64String(parts[1]), mimeType);
    }

    [HttpPost("gerar-termo-lote/{loteId}")]
    public async Task<IActionResult> GerarTermoLote(string loteId)
    {
        using var conn = _db.Create();
        var movs = (await conn.QueryAsync<Movimentacao>(
            "SELECT * FROM movimentacao WHERE LTRIM(RTRIM(lote_id)) = ?", new { loteId })).ToList();

        if (!movs.Any()) return NotFound("Lote não encontrado no banco.");

        foreach (var m in movs)
        {
            m.Equipamento = await conn.QueryFirstOrDefaultAsync<Equipamento>(
                "SELECT * FROM equipamento WHERE id = ?", new { id = m.EquipamentoId });
            m.Tecnico = await conn.QueryFirstOrDefaultAsync<Usuario>(
                "SELECT * FROM usuario WHERE id = ?", new { id = m.TecnicoId });
            if (m.ResponsavelNovoId.HasValue)
            {
                m.ResponsavelNovo = await conn.QueryFirstOrDefaultAsync<Usuario>(
                    "SELECT * FROM usuario WHERE id = ?", new { id = m.ResponsavelNovoId });
                if (m.ResponsavelNovo != null)
                {
                    m.ResponsavelNovo.Perfil = await conn.QueryFirstOrDefaultAsync<Perfil>(
                        "SELECT * FROM perfil WHERE id = ?", new { id = m.ResponsavelNovo.PerfilId });
                }
            }
            if (m.ResponsavelAnteriorId.HasValue)
            {
                m.ResponsavelAnterior = await conn.QueryFirstOrDefaultAsync<Usuario>(
                    "SELECT * FROM usuario WHERE id = ?", new { id = m.ResponsavelAnteriorId.Value });
            }

            if (m.Equipamento != null && m.Equipamento.FornecedorId.HasValue)
            {
                m.Equipamento.Fornecedor = await conn.QueryFirstOrDefaultAsync<Fornecedor>(
                    "SELECT * FROM fornecedor WHERE id = ?", new { id = m.Equipamento.FornecedorId.Value });
            }
        }

        var pdfBytes = _pdfService.GenerateLotePdf(movs);

        // Salva PDF como base64 no banco — sem dependência de filesystem
        var pdfBase64 = Convert.ToBase64String(pdfBytes);
        
        if (conn is System.Data.Odbc.OdbcConnection odbcConn)
        {
            if (odbcConn.State != System.Data.ConnectionState.Open) odbcConn.Open();
            using var cmd = odbcConn.CreateCommand();
            cmd.CommandText = "UPDATE movimentacao SET termo_pdf_url = ? WHERE LTRIM(RTRIM(lote_id)) = ?";
            
            var p1 = new System.Data.Odbc.OdbcParameter("@p1", System.Data.Odbc.OdbcType.NText) { Value = pdfBase64 };
            var p2 = new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.VarChar) { Value = loteId.Trim() };
            
            cmd.Parameters.Add(p1);
            cmd.Parameters.Add(p2);

            await cmd.ExecuteNonQueryAsync();
        }
        else 
        {
            await conn.ExecuteAsync(
                "UPDATE movimentacao SET termo_pdf_url = ? WHERE lote_id = ?",
                new { pdfBase64, loteId });
        }

        _cache.Remove(DashboardController.CacheKey);
        ClearMovimentacoesCache();
        return File(pdfBytes, "application/pdf", $"termo_{loteId}.pdf");
    }

    [HttpGet("termo/{loteId}")]
    public async Task<IActionResult> GetTermoLote(string loteId)
    {
        using var conn = _db.Create();
        var pdfBase64 = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT TOP 1 termo_pdf_url FROM movimentacao WHERE LTRIM(RTRIM(lote_id)) = ?", new { loteId });

        if (string.IsNullOrEmpty(pdfBase64)) return NotFound();

        return File(Convert.FromBase64String(pdfBase64), "application/pdf", $"termo_{loteId}.pdf");
    }

    [HttpPost("enviar-termo/{loteId}")]
    [RequirePermission("movimentacoes:trocar-responsabilidade")]
    public async Task<IActionResult> EnviarTermo(string loteId)
    {
        using var conn = _db.Create();

        // Busca todas as movimentações do lote
        var movs = (await conn.QueryAsync<Movimentacao>(
            "SELECT * FROM movimentacao WHERE LTRIM(RTRIM(lote_id)) = ?", new { loteId })).ToList();

        if (!movs.Any())
            return NotFound(new { detail = "Lote não encontrado." });

        var primeira = movs.First();

        // PDF em base64 já salvo no banco
        var pdfBase64 = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT TOP 1 termo_pdf_url FROM movimentacao WHERE LTRIM(RTRIM(lote_id)) = ?", new { loteId });

        if (string.IsNullOrEmpty(pdfBase64))
            return UnprocessableEntity(new { detail = "Termo PDF ainda não foi gerado para este lote. Gere o termo primeiro." });

        byte[] pdfBytes;
        try { pdfBytes = Convert.FromBase64String(pdfBase64); }
        catch { return UnprocessableEntity(new { detail = "Dados do PDF inválidos no banco." }); }

        // Recebedor (gestor)
        if (!primeira.RecebedorId.HasValue)
            return UnprocessableEntity(new { detail = "Recebedor não definido nesta movimentação." });

        var gestor = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { id = primeira.RecebedorId.Value });

        if (gestor == null)
            return NotFound(new { detail = "Gestor do lote não encontrado." });

        if (string.IsNullOrWhiteSpace(gestor.Email))
            return UnprocessableEntity(new { detail = $"O gestor '{gestor.Nome}' não possui e-mail cadastrado." });

        // Técnico
        var tecnico = await conn.QueryFirstOrDefaultAsync<Usuario>(
            "SELECT * FROM usuario WHERE id = ?", new { id = primeira.TecnicoId });

        // Destino
        var destino = primeira.LocDestinoId.HasValue
            ? await conn.QueryFirstOrDefaultAsync<Localizacao>(
                "SELECT * FROM localizacao WHERE id = ?", new { id = primeira.LocDestinoId.Value })
            : null;

        var destinoDesc = "";
        if (destino != null)
        {
            var parts = new List<string>();
            if (!string.IsNullOrEmpty(destino.Sala)) parts.Add(destino.Sala);
            if (!string.IsNullOrEmpty(destino.Bloco)) parts.Add($"Bloco {destino.Bloco}");
            if (!string.IsNullOrEmpty(destino.Campus)) parts.Add($"Campus {destino.Campus}");
            destinoDesc = string.Join(" — ", parts);
        }

        // Equipamentos do lote
        var equipamentos = new List<(string tipo, string marcaModelo, string serie, string tombamento)>();
        foreach (var mov in movs)
        {
            var eq = await conn.QueryFirstOrDefaultAsync<Equipamento>(
                "SELECT * FROM equipamento WHERE id = ?", new { id = mov.EquipamentoId });
            if (eq != null)
                equipamentos.Add((
                    eq.Tipo ?? "",
                    $"{eq.Marca} {eq.Modelo}".Trim(),
                    eq.NumeroSerie ?? "",
                    eq.NumeroPatrimonio ?? ""
                ));
        }

        bool isTroca = loteId.StartsWith("TR", StringComparison.OrdinalIgnoreCase);

        try
        {
            if (isTroca)
            {
                var responsavelAnterior = primeira.ResponsavelAnteriorId.HasValue
                    ? await conn.QueryFirstOrDefaultAsync<Usuario>(
                        "SELECT * FROM usuario WHERE id = ?", new { id = primeira.ResponsavelAnteriorId.Value })
                    : null;

                await _emailService.EnviarTermoTrocaAsync(
                    pdfBytes: pdfBytes,
                    loteId: loteId,
                    destinatario: gestor.Email,
                    gestorNome: gestor.Nome,
                    responsavelAnteriorNome: responsavelAnterior?.Nome ?? "—",
                    tecnicoNome: tecnico?.Nome ?? "",
                    dataMovimentacao: primeira.DataMovimentacao,
                    equipamentos: equipamentos);
            }
            else
            {
                await _emailService.EnviarTermoAsync(
                    pdfBytes: pdfBytes,
                    loteId: loteId,
                    destinatario: gestor.Email,
                    gestorNome: gestor.Nome,
                    tecnicoNome: tecnico?.Nome ?? "",
                    dataMovimentacao: primeira.DataMovimentacao,
                    destinoDescricao: destinoDesc,
                    equipamentos: equipamentos);
            }

            return Ok(new { ok = true, destinatario = gestor.Email });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { detail = $"Falha ao enviar e-mail: {ex.Message}" });
        }
    }
}
