using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("fornecedor")]
public class Fornecedor
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("nome_empresa")]
    [MaxLength(255)]
    public string NomeEmpresa { get; set; } = string.Empty;

    [Column("sigla")]
    [MaxLength(3)]
    public string? Sigla { get; set; }

    [Column("responsavel")]
    [MaxLength(255)]
    public string Responsavel { get; set; } = string.Empty;

    [Column("telefone1")]
    [MaxLength(20)]
    public string Telefone1 { get; set; } = string.Empty;

    [Column("telefone2")]
    [MaxLength(20)]
    public string? Telefone2 { get; set; }

    [Column("cidade")]
    [MaxLength(100)]
    public string Cidade { get; set; } = string.Empty;

    [Column("cnpj")]
    [MaxLength(20)]
    public string Cnpj { get; set; } = string.Empty;

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
