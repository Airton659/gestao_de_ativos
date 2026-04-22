using System.ComponentModel.DataAnnotations;

namespace GATI.API.DTOs;

public record PerfilRequest(
    [Required] string Nome,
    string? Descricao,
    List<int> PermissoesIds
);
