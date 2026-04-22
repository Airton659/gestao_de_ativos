using System.ComponentModel.DataAnnotations;

namespace GATI.API.DTOs;

public record UsuarioCreate(
    [Required] string Nome,
    [Required] string Matricula,
    [Required] string Email,
    [Required] string Senha,
    int? PerfilId,
    bool Ativo = true
);

public record UsuarioUpdate(
    string? Nome,
    string? Matricula,
    string? Email,
    string? Senha,
    int? PerfilId,
    bool? Ativo,
    string? AssinaturaUrl
);

public record LoginRequest(string Username, string Password);
public record LoginResponse(string AccessToken, string TokenType = "bearer");

public record PermissaoInfo(string Chave);
public record PerfilInfo(string Nome, List<PermissaoInfo> Permissoes);

public record UserResponse(
    int Id,
    string Nome,
    string Matricula,
    string Email,
    int? PerfilId,
    bool Ativo,
    string? AssinaturaUrl,
    PerfilInfo? Perfil
);

public record SalvarAssinaturaRequest(string Base64);
public record AlterarSenhaRequest(string senha_atual, string senha_nova);
public record VerifyManagerRequest(string Matricula, string Senha);
public record VerifyManagerResponse(bool Valid, int GestorId, string Nome);

public record ValidarSenhaGestorRequest(string gestor_matricula, string senha_confirmacao);

public record MovimentacaoCreate(
    int equipamento_id,
    int? loc_origem_id,
    int? loc_destino_id,
    string gestor_matricula,
    string? motivo,
    string? lote_id
);

public class TrocaResponsabilidadeRequest
{
    public int equipamento_id { get; set; }
    public string gestor_matricula { get; set; } = string.Empty;
    public string senha_confirmacao { get; set; } = string.Empty;
    public string? foto_base64 { get; set; }
    public string? motivo { get; set; }
}
