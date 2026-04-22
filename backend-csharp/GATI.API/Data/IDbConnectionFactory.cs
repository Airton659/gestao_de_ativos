using System.Data;

namespace GATI.API.Data;

/// <summary>
/// Abstração da fábrica de conexões com banco de dados.
/// Permite substituição por implementações fake/mock em testes unitários.
/// </summary>
public interface IDbConnectionFactory
{
    IDbConnection Create();
}
