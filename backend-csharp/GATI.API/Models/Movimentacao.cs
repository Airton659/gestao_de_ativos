using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GATI.API.Models;

[Table("movimentacao")]
public class Movimentacao
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("equipamento_id")]
    public int EquipamentoId { get; set; }

    [Column("tecnico_id")]
    public int TecnicoId { get; set; }

    [Column("loc_origem_id")]
    public int? LocOrigemId { get; set; }

    [Column("loc_destino_id")]
    public int? LocDestinoId { get; set; }

    [Column("responsavel_anterior_id")]
    public int? ResponsavelAnteriorId { get; set; }

    [Column("responsavel_novo_id")]
    public int? ResponsavelNovoId { get; set; }

    [Column("recebedor_id")]
    public int? RecebedorId { get; set; }

    [Column("motivo")]
    [MaxLength(500)]
    public string? Motivo { get; set; }


    [Column("data_movimentacao")]
    public DateTime DataMovimentacao { get; set; } = DateTime.UtcNow;

    [Column("data_hora_aceite")]
    public DateTime? DataHoraAceite { get; set; }

    [Column("ip_assinatura")]
    [MaxLength(50)]
    public string? IpAssinatura { get; set; }

    [Column("termo_pdf_url")]
    public string? TermoPdfUrl { get; set; }

    [Column("foto_assinatura_url")]
    public string? FotoAssinaturaUrl { get; set; }

    [Column("lote_id")]
    [MaxLength(36)]
    public string? LoteId { get; set; }

    [ForeignKey("EquipamentoId")]
    public Equipamento? Equipamento { get; set; }

    [ForeignKey("TecnicoId")]
    public Usuario? Tecnico { get; set; }

    [ForeignKey("ResponsavelAnteriorId")]
    public Usuario? ResponsavelAnterior { get; set; }

    [ForeignKey("ResponsavelNovoId")]
    public Usuario? ResponsavelNovo { get; set; }

    [ForeignKey("RecebedorId")]
    public Usuario? Recebedor { get; set; }

    public static DateTime BrasiliaNow() => DateTime.UtcNow.AddHours(-3);
}
