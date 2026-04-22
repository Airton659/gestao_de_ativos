using Microsoft.AspNetCore.Mvc;

namespace GATI.API.DTOs;

// ── Request DTOs (classes para binding correto via [FromQuery]) ───────────────

public class R01InventarioRequest
{
    [FromQuery(Name = "localizacao_ids")]  public List<int>?    LocalizacaoIds        { get; set; }
    [FromQuery(Name = "tipos")]            public List<string>? Tipos                 { get; set; }
    [FromQuery(Name = "status")]           public List<string>? Status                { get; set; }
    [FromQuery(Name = "is_proprio")]       public List<bool>?   IsProprio             { get; set; }
    [FromQuery(Name = "conservacao")]      public List<string>? EstadosConservacao    { get; set; }
    [FromQuery(Name = "data_inicio")]      public DateTime?     DataAquisicaoInicio   { get; set; }
    [FromQuery(Name = "data_fim")]         public DateTime?     DataAquisicaoFim      { get; set; }
    [FromQuery(Name = "fornecedor_ids")]   public List<int>?    FornecedorIds         { get; set; }
}

public class R02LocalizacaoRequest
{
    [FromQuery(Name = "campus")]           public List<string>? Campus            { get; set; }
    [FromQuery(Name = "blocos")]           public List<string>? Blocos            { get; set; }
    [FromQuery(Name = "incluir_vazias")]   public bool          IncluirSalasVazias { get; set; }
    [FromQuery(Name = "tipos")]            public List<string>? Tipos             { get; set; }
}

public class R03HistoricoRequest
{
    [FromQuery(Name = "data_inicio")]      public DateTime      PeriodoInicio  { get; set; }
    [FromQuery(Name = "data_fim")]         public DateTime      PeriodoFim     { get; set; }
    [FromQuery(Name = "equipamento_ids")]  public List<int>?    EquipamentoIds { get; set; }
    [FromQuery(Name = "tecnico_ids")]      public List<int>?    TecnicoIds     { get; set; }
    [FromQuery(Name = "origem_ids")]       public List<int>?    OrigemIds      { get; set; }
    [FromQuery(Name = "destino_ids")]      public List<int>?    DestinoIds     { get; set; }
}

public class R04ResponsavelRequest
{
    [FromQuery(Name = "responsavel_ids")]  public List<int>?    ResponsavelIds { get; set; }
    [FromQuery(Name = "tipos")]            public List<string>? Tipos          { get; set; }
    [FromQuery(Name = "valor_minimo")]     public double?       ValorMinimo    { get; set; }
}

public class R05ManutencaoRequest
{
    [FromQuery(Name = "conservacao")]      public List<string>? EstadosConservacao { get; set; }
    [FromQuery(Name = "anos_minimos")]     public int?          AnosMinimos        { get; set; }
    [FromQuery(Name = "tipos")]            public List<string>? Tipos              { get; set; }
    [FromQuery(Name = "localizacao_ids")]  public List<int>?    LocalizacaoIds     { get; set; }
}

public class R06TermosRequest
{
    [FromQuery(Name = "gestor_ids")]   public List<int>? GestorIds      { get; set; }
    [FromQuery(Name = "data_inicio")]  public DateTime?  PeriodoInicio  { get; set; }
    [FromQuery(Name = "data_fim")]     public DateTime?  PeriodoFim     { get; set; }
}

// ── Result DTOs ───────────────────────────────────────────────────────────────

public class R01Row
{
    public string NumeroPatrimonio  { get; set; } = "";
    public string Tipo              { get; set; } = "";
    public string MarcaModelo       { get; set; } = "";
    public string NumeroSerie       { get; set; } = "";
    public string Status            { get; set; } = "";
    public string EstadoConservacao { get; set; } = "";
    public string Propriedade       { get; set; } = "";
    public string DataAquisicao     { get; set; } = "";
    public string Valor             { get; set; } = "";
    public double ValorNumerico     { get; set; }
    public string Localizacao       { get; set; } = "";
    public string Fornecedor        { get; set; } = "";
    public string Responsavel       { get; set; } = "";
}

public class R01Totais
{
    public int    Total      { get; set; }
    public int    Ativos     { get; set; }
    public int    Inativos   { get; set; }
    public double ValorTotal { get; set; }
}

public class R02Row
{
    public string Campus            { get; set; } = "";
    public string Bloco             { get; set; } = "";
    public string Sala              { get; set; } = "";
    public int    TotalEquipamentos { get; set; }
    public int    Ativos            { get; set; }
    public int    Inativos          { get; set; }
    public string Tipos             { get; set; } = "";
}

public class R03Row
{
    public string DataMovimentacao { get; set; } = "";
    public string Patrimonio       { get; set; } = "";
    public string Tipo             { get; set; } = "";
    public string Tecnico          { get; set; } = "";
    public string Gestor           { get; set; } = "";
    public string Origem           { get; set; } = "";
    public string Destino          { get; set; } = "";
    public string Motivo           { get; set; } = "";
    public string ComTermo         { get; set; } = "";
}

public class R04Row
{
    public string Responsavel { get; set; } = "";
    public string Matricula   { get; set; } = "";
    public string Tipo        { get; set; } = "";
    public int    Quantidade  { get; set; }
    public double ValorTotal  { get; set; }
}

public class R05Row
{
    public string NumeroPatrimonio  { get; set; } = "";
    public string Tipo              { get; set; } = "";
    public string MarcaModelo       { get; set; } = "";
    public string EstadoConservacao { get; set; } = "";
    public string DataAquisicao     { get; set; } = "";
    public int    AnosUso           { get; set; }
    public string Status            { get; set; } = "";
    public string Localizacao       { get; set; } = "";
    public string Responsavel       { get; set; } = "";
    public string Observacoes       { get; set; } = "";
}

public class R06Row
{
    public string Gestor           { get; set; } = "";
    public string Matricula        { get; set; } = "";
    public string LoteId           { get; set; } = "";
    public string DataMovimentacao { get; set; } = "";
    public int    QtdEquipamentos  { get; set; }
    public string StatusTermo      { get; set; } = "";
    public string ComFoto          { get; set; } = "";
}
