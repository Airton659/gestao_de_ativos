using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("permissao")]
public class Permissao
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("chave")]
    [MaxLength(100)]
    public string Chave { get; set; } = string.Empty;

    [Column("nome")]
    [MaxLength(100)]
    public string Nome { get; set; } = string.Empty;

    [Column("descricao")]
    [MaxLength(255)]
    public string? Descricao { get; set; }

    public List<Perfil> Perfis { get; set; } = [];
}
