using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("equipamento")]
public class Equipamento
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("numero_patrimonio")]
    [MaxLength(50)]
    public string NumeroPatrimonio { get; set; } = string.Empty;

    [Column("nome")]
    [MaxLength(255)]
    public string Nome { get; set; } = string.Empty;

    [Column("numero_serie")]
    [MaxLength(100)]
    public string? NumeroSerie { get; set; }

    [Column("tipo")]
    [MaxLength(100)]
    public string Tipo { get; set; } = string.Empty;

    [Column("marca")]
    [MaxLength(100)]
    public string? Marca { get; set; }

    [Column("modelo")]
    [MaxLength(100)]
    public string? Modelo { get; set; }

    [Column("data_aquisicao")]
    public DateTime? DataAquisicao { get; set; }

    [Column("valor")]
    public double? Valor { get; set; }


    [Column("estado_conservacao")]
    [MaxLength(50)]
    public string? EstadoConservacao { get; set; }

    // Returned with alias EspecificacoesJson in SELECT queries
    public string? EspecificacoesJson { get; set; }

    // Returned with alias FotosJson in SELECT queries
    public string? FotosJson { get; set; }

    // Returned via subquery in SELECT — not a real column
    public string? FornecedorSigla { get; set; }

    [Column("ativo")]
    public bool Ativo { get; set; } = true;

    // Fields for DTO mapping (not columns in equipamento table)
    public string? LocalizacaoCampus { get; set; }
    public string? LocalizacaoBloco { get; set; }
    public string? LocalizacaoSala { get; set; }
    public string? ResponsavelNome { get; set; }
    public string? ResponsavelMatricula { get; set; }
    public string? FornecedorNome { get; set; }

    [Column("is_proprio")]
    public bool IsProprio { get; set; } = true;

    [Column("observacoes")]
    [MaxLength(1000)]
    public string? Observacoes { get; set; }

    [Column("localizacao_id")]
    public int? LocalizacaoId { get; set; }

    [Column("responsavel_id")]
    public int? ResponsavelId { get; set; }

    [Column("fornecedor_id")]
    public int? FornecedorId { get; set; }

    [Column("criado_por_id")]
    public int? CriadoPorId { get; set; }

    [Column("criado_em")]
    public DateTime? CriadoEm { get; set; }

    [Column("modificado_por_id")]
    public int? ModificadoPorId { get; set; }

    [Column("modificado_em")]
    public DateTime? ModificadoEm { get; set; }

    public Localizacao? Localizacao { get; set; }
    public Usuario? Responsavel { get; set; }
    public Fornecedor? Fornecedor { get; set; }
}
