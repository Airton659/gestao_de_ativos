namespace GATI.API.DTOs;

public record MovimentacaoResponseDTO(
    int Id,
    DateTime DataMovimentacao,
    int EquipamentoId,
    string? EquipamentoPatrimonio,
    string? EquipamentoMarca,
    string? EquipamentoModelo,
    int? LocOrigemId,
    string? LocOrigemDsc,
    int? LocDestinoId,
    string? LocDestinoDsc,
    int TecnicoId,
    string? TecnicoNome,
    int? RecebedorId,
    string? RecebedorNome,
    string? Motivo,
    string? LoteId,
    string? TermoPdfUrl,
    string? FotoAssinaturaUrl
);
