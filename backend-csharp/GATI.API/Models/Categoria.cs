using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("categoria")]
public class Categoria
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("nome")]
    public string Nome { get; set; } = string.Empty;

    [Column("campos_especificacoes")]
    public string? CamposEspecificacoes { get; set; }

    [Column("criado_por_id")]
    public int? CriadoPorId { get; set; }

    [Column("criado_em")]
    public DateTime? CriadoEm { get; set; }

    [Column("modificado_por_id")]
    public int? ModificadoPorId { get; set; }

    [Column("modificado_em")]
    public DateTime? ModificadoEm { get; set; }
}
