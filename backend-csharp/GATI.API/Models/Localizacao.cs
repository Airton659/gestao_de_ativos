using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("localizacao")]
public class Localizacao
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("campus")]
    [MaxLength(100)]
    public string Campus { get; set; } = string.Empty;

    [Column("bloco")]
    [MaxLength(50)]
    public string? Bloco { get; set; }

    [Column("andar")]
    [MaxLength(20)]
    public string? Andar { get; set; }

    [Column("sala")]
    [MaxLength(100)]
    public string Sala { get; set; } = string.Empty;

    [Column("descricao")]
    [MaxLength(255)]
    public string? Descricao { get; set; }

    [Column("ativo")]
    public bool Ativo { get; set; } = true;

    [Column("criado_por_id")]
    public int? CriadoPorId { get; set; }

    [Column("criado_em")]
    public DateTime? CriadoEm { get; set; }

    [Column("modificado_por_id")]
    public int? ModificadoPorId { get; set; }

    [Column("modificado_em")]
    public DateTime? ModificadoEm { get; set; }

    public List<Equipamento> Equipamentos { get; set; } = [];
}
