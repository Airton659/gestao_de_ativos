using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("usuario")]
public class Usuario
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("nome")]
    [MaxLength(255)]
    public string Nome { get; set; } = string.Empty;

    [Column("matricula")]
    [MaxLength(50)]
    public string Matricula { get; set; } = string.Empty;

    [Column("email")]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Column("senha_hash")]
    [MaxLength(255)]
    public string SenhaHash { get; set; } = string.Empty;

    [Column("perfil_id")]
    public int? PerfilId { get; set; }

    [Column("ativo")]
    public bool Ativo { get; set; } = true;

    [Column("assinatura_url")]
    public string? AssinaturaUrl { get; set; }

    [Column("criado_por_id")]
    public int? CriadoPorId { get; set; }

    [Column("criado_em")]
    public DateTime? CriadoEm { get; set; }

    [Column("modificado_por_id")]
    public int? ModificadoPorId { get; set; }

    [Column("modificado_em")]
    public DateTime? ModificadoEm { get; set; }

    [ForeignKey("PerfilId")]
    public Perfil? Perfil { get; set; }

    public List<Equipamento> Equipamentos { get; set; } = [];
}
