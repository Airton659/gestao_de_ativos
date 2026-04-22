using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("perfil")]
public class Perfil
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("nome")]
    [MaxLength(50)]
    public string Nome { get; set; } = string.Empty;

    [Column("descricao")]
    [MaxLength(255)]
    public string? Descricao { get; set; }

    [Column("criado_por_id")]
    public int? CriadoPorId { get; set; }

    [Column("criado_em")]
    public DateTime? CriadoEm { get; set; }

    [Column("modificado_por_id")]
    public int? ModificadoPorId { get; set; }

    [Column("modificado_em")]
    public DateTime? ModificadoEm { get; set; }

    public List<Permissao> Permissoes { get; set; } = [];
    public List<Usuario> Usuarios { get; set; } = [];
}
