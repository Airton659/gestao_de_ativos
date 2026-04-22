using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("logauditoria")]
public class LogAuditoria
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("usuario_id")]
    public int UsuarioId { get; set; }

    [Column("acao")]
    [MaxLength(50)]
    public string Acao { get; set; } = string.Empty; // CRIAR, EDITAR, EXCLUIR

    [Column("entidade")]
    [MaxLength(50)]
    public string Entidade { get; set; } = string.Empty;

    [Column("entidade_id")]
    public int EntidadeId { get; set; }

    [Column("dados_anteriores_json", TypeName = "nvarchar(max)")]
    public string? DadosAnterioresJson { get; set; }

    [Column("dados_novos_json", TypeName = "nvarchar(max)")]
    public string? DadosNovosJson { get; set; }

    [Column("ip")]
    [MaxLength(50)]
    public string? Ip { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("UsuarioId")]
    public Usuario? Usuario { get; set; }
}
