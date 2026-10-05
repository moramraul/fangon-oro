export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );

export function mailTemplate(
  title: string,
  content: string,
  url?: string,
  button = 'IR AL EVENTO',
) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0c0b09;color:#eee4cd;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid #a67c32;background:#15120d"><tr><td align="center" style="padding:40px 24px;border-bottom:1px solid #a67c32;background:#211a0e"><img src="cid:fangon-emblema" width="160" height="160" alt="Emblema dorado del Fangón de Oro" style="display:block;margin:0 auto 24px;border:0"><div style="color:#d9ad54;font-size:12px;letter-spacing:5px">LOS PREMIOS</div><div style="font-family:Georgia,serif;font-size:38px;color:#f0ce83;margin-top:14px">FANGÓN DE ORO</div><div style="color:#b68b40;margin-top:18px">◆ ━━━━━ ◆ ━━━━━ ◆</div></td></tr><tr><td style="padding:32px 28px;text-align:center"><h1 style="font-family:Georgia,serif;font-size:28px;color:#f0ce83">${escapeHtml(title)}</h1>${content}${url ? `<p style="margin:32px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:17px 28px;background:#e8b954;color:#171108;border:1px solid #f9dc96;border-radius:8px;font-weight:bold;text-decoration:none">${escapeHtml(button)} →</a></p><p style="font-size:12px;color:#bdb39e;word-break:break-all">Si el botón no funciona, abre este enlace:<br><a style="color:#e8b954" href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''}</td></tr><tr><td align="center" style="padding:24px;border-top:1px solid #6e542c;color:#aaa08d;font-family:Georgia,serif">Que gane el más fangón.<br>Nos vemos en la votación.</td></tr></table></td></tr></table></body></html>`;
}
