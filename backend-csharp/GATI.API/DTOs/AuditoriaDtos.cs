using System.Text.Json;

namespace GATI.API.DTOs;

public class LogAuditoriaRow
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string? UsuarioNome { get; set; }
    public string Acao { get; set; } = string.Empty;
    public string Entidade { get; set; } = string.Empty;
    public int EntidadeId { get; set; }
    public string? DadosAnterioresJson { get; set; }
    public string? DadosNovosJson { get; set; }
    public string? Ip { get; set; }
    public DateTime CreatedAt { get; set; }
    public long RowNum { get; set; }
}

public record LogAuditoriaResponse(
    int Id,
    int UsuarioId,
    string? UsuarioNome,
    string Acao,
    string Entidade,
    int EntidadeId,
    JsonElement? DadosAnterioresJson,
    JsonElement? DadosNovosJson,
    string? Ip,
    DateTime CreatedAt
);
