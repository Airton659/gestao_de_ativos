using System.ComponentModel.DataAnnotations;

namespace GATI.API.DTOs;

public record CategoriaCreate
{
    [Required(ErrorMessage = "O nome da categoria é obrigatório.")]
    [StringLength(100, ErrorMessage = "O nome não pode exceder 100 caracteres.")]
    public string Nome { get; init; } = string.Empty;
    public string? CamposEspecificacoes { get; init; }
}

public record CategoriaUpdate
{
    [StringLength(100, ErrorMessage = "O nome não pode exceder 100 caracteres.")]
    public string? Nome { get; init; }
    public string? CamposEspecificacoes { get; init; }
}
