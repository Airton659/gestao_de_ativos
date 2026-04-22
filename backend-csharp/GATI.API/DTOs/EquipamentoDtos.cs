using System.Text.Json;

namespace GATI.API.DTOs;

public record EquipamentoCreate(
    string NumeroPatrimonio,
    string Nome,
    string? NumeroSerie,
    string Tipo,
    string? Marca,
    string? Modelo,
    DateTime? DataAquisicao,
    double? Valor,
    string? EstadoConservacao,
    List<string>? Fotos,
    JsonElement? Especificacoes,
    bool IsProprio,
    string? Observacoes,
    int? LocalizacaoId,
    int? ResponsavelId,
    int? FornecedorId
);

public record EquipamentoUpdate(
    string? NumeroPatrimonio,
    string? Nome,
    string? NumeroSerie,
    string? Tipo,
    string? Marca,
    string? Modelo,
    DateTime? DataAquisicao,
    double? Valor,
    string? EstadoConservacao,
    List<string>? Fotos,
    JsonElement? Especificacoes,
    bool? IsProprio,
    bool? Ativo,
    string? Observacoes,
    int? LocalizacaoId,
    int? ResponsavelId,
    int? FornecedorId
);

public record LocalizacaoResponse(
    int Id,
    string Campus,
    string? Bloco,
    string Sala
);

public record ResponsavelResponse(
    int Id,
    string Nome,
    string? Matricula
);

public record FornecedorResponse(
    int Id,
    string NomeEmpresa
);

public record EquipamentoResponse(
    int Id,
    string NumeroPatrimonio,
    string Nome,
    string? NumeroSerie,
    string Tipo,
    string? Marca,
    string? Modelo,
    DateTime? DataAquisicao,
    double? Valor,
    string? EstadoConservacao,
    List<string>? Fotos,
    JsonElement? Especificacoes,
    bool Ativo,
    bool IsProprio,
    string? Observacoes,
    int? LocalizacaoId,
    int? ResponsavelId,
    int? FornecedorId,
    string? FornecedorSigla,
    LocalizacaoResponse? Localizacao = null,
    ResponsavelResponse? Responsavel = null,
    FornecedorResponse? Fornecedor = null,
    int? CriadoPorId = null,
    DateTime? CriadoEm = null,
    int? ModificadoPorId = null,
    DateTime? ModificadoEm = null
);
