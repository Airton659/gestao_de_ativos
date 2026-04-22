using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace GATI.API.Services;

public class SmtpSettings
{
    public string Host { get; set; } = "smtp.gmail.com";
    public int Port { get; set; } = 587;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromName { get; set; } = "Gestão de Ativos de TI";
    public string From { get; set; } = string.Empty;
}

public class EmailService
{
    private readonly SmtpSettings _smtp;

    public EmailService(IConfiguration config)
    {
        _smtp = config.GetSection("Smtp").Get<SmtpSettings>() ?? new SmtpSettings();
    }

    public async Task EnviarTermoAsync(
        byte[] pdfBytes,
        string loteId,
        string destinatario,
        string gestorNome,
        string tecnicoNome,
        DateTime dataMovimentacao,
        string destinoDescricao,
        IEnumerable<(string tipo, string marcaModelo, string serie, string tombamento)> equipamentos)
    {
        if (string.IsNullOrWhiteSpace(destinatario))
            throw new InvalidOperationException("Destinatário sem e-mail cadastrado.");

        var meses = new[] {
            "janeiro","fevereiro","março","abril","maio","junho",
            "julho","agosto","setembro","outubro","novembro","dezembro"
        };
        var dataBr = dataMovimentacao.AddHours(-3);
        var dataStr = $"{dataBr.Day} de {meses[dataBr.Month - 1]} de {dataBr.Year}, às {dataBr:HH:mm}";

        var linhasEquip = new StringBuilder();
        var i = 0;
        foreach (var eq in equipamentos)
        {
            var bg = i++ % 2 == 0 ? "#f8fafc" : "#ffffff";
            linhasEquip.Append($"""
                <tr style="background:{bg}">
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{eq.tipo}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{eq.marcaModelo}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{(string.IsNullOrEmpty(eq.serie) ? "—" : eq.serie)}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{(string.IsNullOrEmpty(eq.tombamento) ? "—" : eq.tombamento)}</td>
                </tr>
                """);
        }

        var html = $"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <tr>
                      <td style="background:#003087;padding:28px 40px;">
                        <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">GESTÃO DE ATIVOS</p>
                        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;">Termo de Movimentação de Equipamentos</h1>
                      </td>
                    </tr>

                    <tr><td style="padding:36px 40px;">
                      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                        Olá, <strong style="color:#1e293b;">{gestorNome}</strong>!<br><br>
                        O seu Termo de Movimentação de Equipamentos de TI foi gerado com sucesso.
                        O documento está anexado a este e-mail em formato PDF.
                      </p>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
                        <tr><td style="padding:20px 24px;">
                          <p style="margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">Informações da Movimentação</p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;width:150px;">Data</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{dataStr}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Destino</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{destinoDescricao}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Técnico responsável</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{tecnicoNome}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Nº do Lote</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;font-family:monospace;">{loteId}</td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>

                      <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">Equipamentos Recebidos</p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:28px;">
                        <tr style="background:#1a4fa0;">
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Tipo</th>
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Marca / Modelo</th>
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Nº de Série</th>
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Patrimônio</th>
                        </tr>
                        {linhasEquip}
                      </table>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;border-radius:12px;border:1px solid #c0d0e8;">
                        <tr><td style="padding:18px 22px;">
                          <p style="margin:0;color:#1a4fa0;font-size:13px;line-height:1.6;">
                            <strong>Guarde este documento.</strong> Ele confirma o recebimento dos equipamentos acima
                            e está em conformidade com as normas de patrimônio da organização.
                          </p>
                        </td></tr>
                      </table>
                    </td></tr>

                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                        <p style="margin:0;color:#94a3b8;font-size:12px;">
                          Departamento de Tecnologia da Informação<br>
                          Este é um e-mail automático gerado pelo Sistema de Gestão de Ativos de TI.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        using var msg = new MailMessage();
        msg.From = new MailAddress(_smtp.From, _smtp.FromName, Encoding.UTF8);
        msg.To.Add(destinatario);
        msg.Subject = $"Termo de Movimentação de Equipamentos — Lote {loteId[..Math.Min(8, loteId.Length)].ToUpper()}";
        msg.IsBodyHtml = true;
        msg.Body = html;
        msg.BodyEncoding = Encoding.UTF8;
        msg.SubjectEncoding = Encoding.UTF8;

        // Anexa o PDF
        var pdfStream = new MemoryStream(pdfBytes);
        var attachment = new Attachment(pdfStream, $"termo_movimentacao_{loteId[..Math.Min(8, loteId.Length)]}.pdf", "application/pdf");
        msg.Attachments.Add(attachment);

        using var client = new SmtpClient(_smtp.Host, _smtp.Port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(_smtp.User, _smtp.Password),
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 30_000
        };

        await client.SendMailAsync(msg);
    }

    public async Task EnviarTermoTrocaAsync(
        byte[] pdfBytes,
        string loteId,
        string destinatario,
        string gestorNome,
        string responsavelAnteriorNome,
        string tecnicoNome,
        DateTime dataMovimentacao,
        IEnumerable<(string tipo, string marcaModelo, string serie, string tombamento)> equipamentos)
    {
        if (string.IsNullOrWhiteSpace(destinatario))
            throw new InvalidOperationException("Destinatário sem e-mail cadastrado.");

        var meses = new[] {
            "janeiro","fevereiro","março","abril","maio","junho",
            "julho","agosto","setembro","outubro","novembro","dezembro"
        };
        var dataBr = dataMovimentacao.AddHours(-3);
        var dataStr = $"{dataBr.Day} de {meses[dataBr.Month - 1]} de {dataBr.Year}, às {dataBr:HH:mm}";

        var linhasEquip = new StringBuilder();
        var i = 0;
        foreach (var eq in equipamentos)
        {
            var bg = i++ % 2 == 0 ? "#f8fafc" : "#ffffff";
            linhasEquip.Append($"""
                <tr style="background:{bg}">
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{eq.tipo}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{eq.marcaModelo}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{(string.IsNullOrEmpty(eq.serie) ? "—" : eq.serie)}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">{(string.IsNullOrEmpty(eq.tombamento) ? "—" : eq.tombamento)}</td>
                </tr>
                """);
        }

        var html = $"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
                <tr><td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                    <tr>
                      <td style="background:#003087;padding:28px 40px;">
                        <p style="margin:0;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.7;">GESTÃO DE ATIVOS</p>
                        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;">Termo de Troca de Responsabilidade</h1>
                      </td>
                    </tr>

                    <tr><td style="padding:36px 40px;">
                      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                        Olá, <strong style="color:#1e293b;">{gestorNome}</strong>!<br><br>
                        A responsabilidade sobre o(s) equipamento(s) abaixo foi transferida para você.
                        O Termo de Troca de Responsabilidade está anexado a este e-mail em formato PDF.
                      </p>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:28px;">
                        <tr><td style="padding:20px 24px;">
                          <p style="margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">Informações da Transferência</p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;width:180px;">Data</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{dataStr}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Responsável anterior</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{responsavelAnteriorNome}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Novo responsável</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{gestorNome}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Executado por</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;">{tecnicoNome}</td>
                            </tr>
                            <tr>
                              <td style="padding:5px 0;color:#64748b;font-size:13px;">Nº do Lote</td>
                              <td style="padding:5px 0;color:#1e293b;font-size:13px;font-weight:600;font-family:monospace;">{loteId}</td>
                            </tr>
                          </table>
                        </td></tr>
                      </table>

                      <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;">Equipamentos sob sua Responsabilidade</p>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:28px;">
                        <tr style="background:#1a4fa0;">
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Tipo</th>
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Marca / Modelo</th>
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Nº de Série</th>
                          <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;">Patrimônio</th>
                        </tr>
                        {linhasEquip}
                      </table>

                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;border-radius:12px;border:1px solid #c0d0e8;">
                        <tr><td style="padding:18px 22px;">
                          <p style="margin:0;color:#1a4fa0;font-size:13px;line-height:1.6;">
                            <strong>Guarde este documento.</strong> Ele registra formalmente a transferência de custódia
                            dos equipamentos acima e está em conformidade com as normas de patrimônio da organização.
                          </p>
                        </td></tr>
                      </table>
                    </td></tr>

                    <tr>
                      <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
                        <p style="margin:0;color:#94a3b8;font-size:12px;">
                          Departamento de Tecnologia da Informação<br>
                          Este é um e-mail automático gerado pelo Sistema de Gestão de Ativos de TI.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;

        using var msg = new MailMessage();
        msg.From = new MailAddress(_smtp.From, _smtp.FromName, Encoding.UTF8);
        msg.To.Add(destinatario);
        msg.Subject = $"Termo de Troca de Responsabilidade — Lote {loteId[..Math.Min(10, loteId.Length)].ToUpper()}";
        msg.IsBodyHtml = true;
        msg.Body = html;
        msg.BodyEncoding = Encoding.UTF8;
        msg.SubjectEncoding = Encoding.UTF8;

        var pdfStream = new MemoryStream(pdfBytes);
        var attachment = new Attachment(pdfStream, $"termo_troca_responsabilidade_{loteId[..Math.Min(10, loteId.Length)]}.pdf", "application/pdf");
        msg.Attachments.Add(attachment);

        using var client = new SmtpClient(_smtp.Host, _smtp.Port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(_smtp.User, _smtp.Password),
            DeliveryMethod = SmtpDeliveryMethod.Network,
            Timeout = 30_000
        };

        await client.SendMailAsync(msg);
    }
}
