using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Text.Json;
using System.Linq;
using System.Collections.Generic;
using GATI.API.Data;
using GATI.API.DTOs;
using GATI.API.Models;
using GATI.API.Middleware;
using GATI.API.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;

namespace GATI.API.Controllers;

[Route("api/v1/equipamentos")]
[ApiController]
public class EquipamentosController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly AuditService _auditService;

    // Colunas completas (com fotos) — usado em queries de detalhe/edição
    private const string SelectCols =
        @"e.id, e.numero_patrimonio, e.nome, e.numero_serie, e.tipo, e.marca, e.modelo, e.data_aquisicao,
          e.valor, e.estado_conservacao,
          e.especificacoes AS especificacoes_json,
          e.fotos AS fotos_json,
          e.ativo, e.is_proprio, e.observacoes, e.localizacao_id, e.responsavel_id, e.fornecedor_id,
          e.criado_por_id, e.criado_em, e.modificado_por_id, e.modificado_em,
          f.sigla AS fornecedor_sigla, f.nome_empresa AS fornecedor_nome,
          l.campus AS localizacao_campus, l.bloco AS localizacao_bloco, l.sala AS localizacao_sala,
          u.nome AS responsavel_nome, u.matricula AS responsavel_matricula";

    // Sem fotos — usado na listagem geral para evitar transferir MB de base64 desnecessariamente
    private const string SelectColsLight =
        @"e.id, e.numero_patrimonio, e.nome, e.numero_serie, e.tipo, e.marca, e.modelo, e.data_aquisicao,
          e.valor, e.estado_conservacao,
          e.especificacoes AS especificacoes_json,
          CAST(NULL AS NVARCHAR(MAX)) AS fotos_json,
          e.ativo, e.is_proprio, e.observacoes, e.localizacao_id, e.responsavel_id, e.fornecedor_id,
          e.criado_por_id, e.criado_em, e.modificado_por_id, e.modificado_em,
          f.sigla AS fornecedor_sigla, f.nome_empresa AS fornecedor_nome,
          l.campus AS localizacao_campus, l.bloco AS localizacao_bloco, l.sala AS localizacao_sala,
          u.nome AS responsavel_nome, u.matricula AS responsavel_matricula";

    private const string FromJoints =
        @"FROM equipamento e
          LEFT JOIN localizacao l ON e.localizacao_id = l.id
          LEFT JOIN usuario u ON e.responsavel_id = u.id
          LEFT JOIN fornecedor f ON e.fornecedor_id = f.id";

    private readonly IMemoryCache _cache;
    private const string CachePrefix = "equipamentos_";
    private static System.Threading.CancellationTokenSource _resetCacheToken = new();

    public EquipamentosController(IDbConnectionFactory db, AuditService auditService, IMemoryCache cache)
    {
        _db = db;
        _auditService = auditService;
        _cache = cache;
    }

    [HttpGet]
    [RequirePermission("equipamentos:ler")]
    public async Task<IActionResult> GetEquipamentos(
        [FromQuery] int skip = 0,
        [FromQuery] int limit = 100,
        [FromQuery] int? fornecedor_id = null,
        [FromQuery] int? localizacao_id = null,
        [FromQuery] string? tipo = null,
        [FromQuery(Name = "include_fotos")] bool includeFotos = false)
    {
        using var conn = _db.Create();

        var where = new List<string>();
        var dp = new DynamicParameters();
        int pIdx = 1;

        if (fornecedor_id.HasValue) {
            where.Add("e.fornecedor_id = ?");
            dp.Add("p" + (pIdx++), fornecedor_id.Value);
        }
        if (localizacao_id.HasValue) {
            where.Add("e.localizacao_id = ?");
            dp.Add("p" + (pIdx++), localizacao_id.Value);
        }
        if (!string.IsNullOrEmpty(tipo)) {
            where.Add("e.tipo = ?");
            dp.Add("p" + (pIdx++), tipo);
        }

        var cols = includeFotos ? SelectCols : SelectColsLight;
        var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

        var sql = $@"
            SELECT * FROM (
                SELECT {cols}, ROW_NUMBER() OVER (ORDER BY e.id) as row_num
                {FromJoints}
                {whereClause}
            ) AS t
            WHERE t.row_num > {skip} AND t.row_num <= {skip + limit}
            ORDER BY t.row_num";

        try {
            if (conn.State != System.Data.ConnectionState.Open)
                ((System.Data.Common.DbConnection)conn).Open();

            var equipamentos = await conn.QueryAsync<Equipamento>(sql, dp);
            var response = equipamentos.Select(MapToResponse).ToList();
            return Ok(response);
        } catch (Exception ex) {
            return StatusCode(500, new { detail = $"Erro ao processar ativos: {ex.Message}" });
        }
        //}) ?? Ok(Enumerable.Empty<EquipamentoResponse>());
    }

    [HttpGet("tipos")]
    [RequirePermission("equipamentos:ler")]
    public async Task<IActionResult> GetTipos()
    {
        using var conn = _db.Create();
        try {
            if (conn.State != System.Data.ConnectionState.Open)
                ((System.Data.Common.DbConnection)conn).Open();

            var tipos = await conn.QueryAsync<string>(
                "SELECT DISTINCT tipo FROM equipamento WHERE tipo IS NOT NULL AND LTRIM(RTRIM(tipo)) <> '' ORDER BY tipo");

            return Ok(tipos.ToList());
        } catch (Exception ex) {
            _ = ex;
            return StatusCode(500, new { detail = "Erro ao buscar tipos." });
        }
    }

    [HttpGet("paginated")]
    [RequirePermission("equipamentos:ler")]
    public async Task<IActionResult> GetPaginated(
        [FromQuery] int page = 1,
        [FromQuery] int page_size = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery(Name = "tipos")] List<string>? tipos = null,
        [FromQuery(Name = "conservacoes")] List<string>? conservacoes = null,
        [FromQuery] string? local = null,
        [FromQuery] string? responsavel = null,
        [FromQuery] string? data_de = null,
        [FromQuery] string? data_ate = null,
        [FromQuery] string? has_foto = null,
        [FromQuery] string? is_proprio = null,
        [FromQuery] int? fornecedor_id = null)
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
                where.Add("(e.numero_patrimonio LIKE ? OR e.nome LIKE ? OR e.numero_serie LIKE ? OR e.marca LIKE ? OR e.modelo LIKE ?)");
                dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s);
                dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s);
            }

            if (!string.IsNullOrWhiteSpace(status)) {
                where.Add("e.ativo = ?");
                dp.Add("p" + (pIdx++), status.ToUpper() == "ATIVO" ? 1 : 0);
            }

            if (tipos != null && tipos.Count > 0) {
                var placeholders = string.Join(",", tipos.Select(_ => "?"));
                where.Add($"e.tipo IN ({placeholders})");
                foreach (var t in tipos) dp.Add("p" + (pIdx++), t);
            }

            if (conservacoes != null && conservacoes.Count > 0) {
                var placeholders = string.Join(",", conservacoes.Select(_ => "?"));
                where.Add($"e.estado_conservacao IN ({placeholders})");
                foreach (var c in conservacoes) dp.Add("p" + (pIdx++), c);
            }

            if (!string.IsNullOrWhiteSpace(local)) {
                var s = $"%{local}%";
                where.Add("(l.campus LIKE ? OR l.bloco LIKE ? OR l.sala LIKE ?)");
                dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s); dp.Add("p" + (pIdx++), s);
            }

            if (!string.IsNullOrWhiteSpace(responsavel)) {
                where.Add("u.nome LIKE ?");
                dp.Add("p" + (pIdx++), $"%{responsavel}%");
            }

            if (!string.IsNullOrWhiteSpace(data_de)) {
                where.Add("e.data_aquisicao >= ?");
                dp.Add("p" + (pIdx++), data_de);
            }

            if (!string.IsNullOrWhiteSpace(data_ate)) {
                where.Add("e.data_aquisicao <= ?");
                dp.Add("p" + (pIdx++), data_ate);
            }

            if (!string.IsNullOrWhiteSpace(has_foto)) {
                var hasFotoUpper = has_foto.ToUpper();
                if (hasFotoUpper == "SIM")
                    where.Add("(e.fotos IS NOT NULL AND e.fotos <> '' AND e.fotos <> '[]')");
                else if (hasFotoUpper == "NAO")
                    where.Add("(e.fotos IS NULL OR e.fotos = '' OR e.fotos = '[]')");
            }

            if (!string.IsNullOrWhiteSpace(is_proprio)) {
                where.Add("e.is_proprio = ?");
                dp.Add("p" + (pIdx++), is_proprio.ToLower() == "true" ? 1 : 0);
            }

            if (fornecedor_id.HasValue) {
                where.Add("e.fornecedor_id = ?");
                dp.Add("p" + (pIdx++), fornecedor_id.Value);
            }

            var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
            var skip = (page - 1) * page_size;

            var countSql = $"SELECT COUNT(*) {FromJoints} {whereClause}";
            var total = await conn.ExecuteScalarAsync<int>(countSql, dp);

            var itemsSql = $@"
                SELECT * FROM (
                    SELECT {SelectColsLight}, ROW_NUMBER() OVER (ORDER BY e.id) as row_num
                    {FromJoints}
                    {whereClause}
                ) AS t
                WHERE t.row_num > {skip} AND t.row_num <= {skip + page_size}
                ORDER BY t.row_num";

            var equipamentos = await conn.QueryAsync<Equipamento>(itemsSql, dp);
            var items = equipamentos.Select(MapToResponse).ToList();

            return Ok(new { items, total, page, page_size });
        } catch (Exception ex) {
            return StatusCode(500, new { detail = $"Erro ao buscar ativos: {ex.Message}" });
        }
    }

    private void ClearEquipamentoCache()
    {
        var oldToken = _resetCacheToken;
        _resetCacheToken = new System.Threading.CancellationTokenSource();
        oldToken.Cancel();
        oldToken.Dispose();
    }

    [HttpGet("{id:int}")]
    [RequirePermission("equipamentos:ler")]
    public async Task<ActionResult<EquipamentoResponse>> GetEquipamento(int id)
    {
        using var conn = _db.Create();
        try {
            if (conn.State != System.Data.ConnectionState.Open)
                ((System.Data.Common.DbConnection)conn).Open();

            var equip = await conn.QueryFirstOrDefaultAsync<Equipamento>(
                $"SELECT {SelectCols} {FromJoints} WHERE e.id = ?", new { id });

            if (equip == null) return NotFound();
            return Ok(MapToResponse(equip));
        } catch (Exception ex) {
            _ = ex;
            return StatusCode(500, new { detail = "Erro ao buscar detalhes do ativo." });
        }
    }

    [HttpPost]
    [RequirePermission("equipamentos:criar")]
    public async Task<ActionResult<EquipamentoResponse>> CreateEquipamento(EquipamentoCreate req)
    {
        using var conn = _db.Create();
        try
        {
            var espJson = req.Especificacoes.HasValue ? JsonSerializer.Serialize(req.Especificacoes.Value) : null;
            var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
            var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

            // INSERT sem fotos — Dapper via ODBC truncaria strings grandes em 8000 chars
            var id = await conn.ExecuteScalarAsync<int>(
                @"INSERT INTO equipamento (numero_patrimonio, nome, numero_serie, tipo, marca, modelo,
                  data_aquisicao, valor, estado_conservacao, especificacoes,
                  is_proprio, observacoes, localizacao_id, responsavel_id, fornecedor_id,
                  criado_por_id, criado_em, ativo)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1);
                  SELECT CAST(SCOPE_IDENTITY() AS int)",
                new { req.NumeroPatrimonio, req.Nome, req.NumeroSerie, req.Tipo, req.Marca, req.Modelo,
                      req.DataAquisicao, req.Valor, req.EstadoConservacao,
                      especificacoesJson = espJson, req.IsProprio, req.Observacoes,
                      req.LocalizacaoId, req.ResponsavelId, req.FornecedorId,
                      criadoPorId = userId, criadoEm = now });

            // Salva fotos separadamente via OdbcCommand com NText para evitar truncamento
            if (req.Fotos != null && req.Fotos.Count > 0)
                await SaveFotosAsync(id, JsonSerializer.Serialize(req.Fotos));

            var equip = await conn.QueryFirstOrDefaultAsync<Equipamento>(
                $"SELECT {SelectCols} {FromJoints} WHERE e.id = ?", new { id });

            await _auditService.RegistrarLog(userId, "CRIAR", "equipamento", id, null, MapToResponse(equip!),
                HttpContext.Connection.RemoteIpAddress?.ToString());

            ClearEquipamentoCache();
            return CreatedAtAction(nameof(GetEquipamentos), new { id }, MapToResponse(equip!));
        }
        catch (System.Data.Odbc.OdbcException ex) when (ex.Message.Contains("duplicate key") || ex.Message.Contains("ix_equipamento_patrimonio_unico"))
        {
            return Conflict(new { detail = "Já existe um equipamento com esse patrimônio para este fornecedor." });
        }
    }

    [HttpPost("upload-foto")]
    [RequirePermission("equipamentos:criar")]
    public async Task<IActionResult> UploadFoto(IFormFile file)
    {
        var allowedMimes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedMimes.Contains(file.ContentType))
            return BadRequest(new { detail = "Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { detail = "Arquivo muito grande. Máximo 5MB." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var dataUri = $"data:{file.ContentType};base64,{Convert.ToBase64String(ms.ToArray())}";

        return Ok(new { url = dataUri });
    }

    [HttpPut("{id}")]
    [RequirePermission("equipamentos:editar")]
    public async Task<ActionResult<EquipamentoResponse>> UpdateEquipamento(int id, EquipamentoUpdate req)
    {
        using var conn = _db.Create();

        var equip = await conn.QueryFirstOrDefaultAsync<Equipamento>(
            $"SELECT {SelectCols} {FromJoints} WHERE e.id = ?", new { id });
        if (equip == null) return NotFound();

        var oldData = MapToResponse(equip);

        // Campos obrigatórios: só atualiza se enviado (não devem ser nulos num PUT válido)
        equip.NumeroPatrimonio = req.NumeroPatrimonio ?? equip.NumeroPatrimonio;
        equip.Nome             = req.Nome             ?? equip.Nome;
        equip.Tipo             = req.Tipo             ?? equip.Tipo;
        equip.IsProprio        = req.IsProprio        ?? equip.IsProprio;
        equip.Ativo            = req.Ativo            ?? equip.Ativo;

        // Campos anuláveis: sempre atualiza (null = limpar o campo intencionalmente)
        equip.NumeroSerie       = req.NumeroSerie;
        equip.Marca             = req.Marca;
        equip.Modelo            = req.Modelo;
        equip.DataAquisicao     = req.DataAquisicao;
        equip.Valor             = req.Valor;
        equip.EstadoConservacao = req.EstadoConservacao;
        equip.Observacoes       = req.Observacoes;
        equip.LocalizacaoId     = req.LocalizacaoId;
        equip.ResponsavelId     = req.ResponsavelId;
        equip.FornecedorId      = req.FornecedorId;

        // Especificacoes: JsonElement? — null genuíno se ausente no payload; HasValue = foi enviado
        if (req.Especificacoes.HasValue) equip.EspecificacoesJson = JsonSerializer.Serialize(req.Especificacoes.Value);
        if (req.Fotos != null) equip.FotosJson = JsonSerializer.Serialize(req.Fotos);

        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        var now = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3), DateTimeKind.Unspecified);

        // UPDATE sem fotos — Dapper via ODBC truncaria strings grandes em 8000 chars
        await conn.ExecuteAsync(
            @"UPDATE equipamento SET numero_patrimonio = ?, nome = ?, numero_serie = ?, tipo = ?,
              marca = ?, modelo = ?, data_aquisicao = ?, valor = ?,
              estado_conservacao = ?, especificacoes = ?, is_proprio = ?,
              ativo = ?, observacoes = ?, localizacao_id = ?, responsavel_id = ?, fornecedor_id = ?,
              modificado_por_id = ?, modificado_em = ?
              WHERE id = ?",
            new { equip.NumeroPatrimonio, equip.Nome, equip.NumeroSerie, equip.Tipo,
                  equip.Marca, equip.Modelo, equip.DataAquisicao, equip.Valor,
                  equip.EstadoConservacao, equip.EspecificacoesJson,
                  equip.IsProprio, equip.Ativo, equip.Observacoes, equip.LocalizacaoId,
                  equip.ResponsavelId, equip.FornecedorId,
                  modificadoPorId = userId, modificadoEm = now, id });

        // Salva fotos separadamente via OdbcCommand com NText para evitar truncamento
        // [] = limpar fotos (salva NULL), [url...] = atualizar
        if (req.Fotos != null)
            await SaveFotosAsync(id, req.Fotos.Count > 0 ? equip.FotosJson : null);
        await _auditService.RegistrarLog(userId, "EDITAR", "equipamento", id, oldData, MapToResponse(equip),
            HttpContext.Connection.RemoteIpAddress?.ToString());

        ClearEquipamentoCache();
        return Ok(MapToResponse(equip));
    }

    [HttpDelete("{id}")]
    [RequirePermission("equipamentos:excluir")]
    public async Task<IActionResult> DeleteEquipamento(int id)
    {
        using var conn = _db.Create();

        var equip = await conn.QueryFirstOrDefaultAsync<Equipamento>(
            $"SELECT {SelectCols} {FromJoints} WHERE e.id = ?", new { id });
        if (equip == null) return NotFound();

        var oldData = MapToResponse(equip);
        await conn.ExecuteAsync("DELETE FROM equipamento WHERE id = ?", new { id });

        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);
        await _auditService.RegistrarLog(userId, "EXCLUIR", "equipamento", id, oldData, null,
            HttpContext.Connection.RemoteIpAddress?.ToString());

        ClearEquipamentoCache();
        return Ok(new { ok = true });
    }

    private async Task SaveFotosAsync(int equipamentoId, string? fotosJson)
    {
        using var odbcConn = (System.Data.Odbc.OdbcConnection)_db.Create();
        await odbcConn.OpenAsync();

        using var cmd = odbcConn.CreateCommand();
        cmd.CommandText = "UPDATE equipamento SET fotos = ? WHERE id = ?";

        var p1 = new System.Data.Odbc.OdbcParameter("@p1", System.Data.Odbc.OdbcType.NText)
            { Value = fotosJson ?? (object)DBNull.Value };
        var p2 = new System.Data.Odbc.OdbcParameter("@p2", System.Data.Odbc.OdbcType.Int)
            { Value = equipamentoId };

        cmd.Parameters.Add(p1);
        cmd.Parameters.Add(p2);

        await cmd.ExecuteNonQueryAsync();
    }

    private static EquipamentoResponse MapToResponse(Equipamento e)
    {
        List<string>? fotos = null;
        if (e.FotosJson != null)
        {
            try { fotos = JsonSerializer.Deserialize<List<string>>(e.FotosJson); }
            catch
            {
                // JSON corrompido (truncado por versão anterior via Dapper) — ignora
            }
        }

        JsonElement? esp = null;
        if (e.EspecificacoesJson != null)
        {
            try { esp = JsonSerializer.Deserialize<JsonElement>(e.EspecificacoesJson); }
            catch { /* ignora especificações corrompidas */ }
        }
        var loc = e.LocalizacaoId.HasValue && e.LocalizacaoCampus != null
            ? new LocalizacaoResponse(e.LocalizacaoId.Value, e.LocalizacaoCampus, e.LocalizacaoBloco, e.LocalizacaoSala ?? "")
            : null;

        var resp = e.ResponsavelId.HasValue && e.ResponsavelNome != null
            ? new ResponsavelResponse(e.ResponsavelId.Value, e.ResponsavelNome, e.ResponsavelMatricula)
            : null;

        var forn = e.FornecedorId.HasValue && e.FornecedorNome != null
            ? new FornecedorResponse(e.FornecedorId.Value, e.FornecedorNome)
            : null;

        return new(e.Id, e.NumeroPatrimonio, e.Nome, e.NumeroSerie, e.Tipo, e.Marca, e.Modelo,
            e.DataAquisicao, e.Valor, e.EstadoConservacao, fotos, esp,
            e.Ativo, e.IsProprio, e.Observacoes, e.LocalizacaoId, e.ResponsavelId, e.FornecedorId,
            e.FornecedorSigla, loc, resp, forn,
            e.CriadoPorId, e.CriadoEm, e.ModificadoPorId, e.ModificadoEm);
    }
}
