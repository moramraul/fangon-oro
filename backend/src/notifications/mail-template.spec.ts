import { mailTemplate } from './mail-template';

describe('Mail template', () => {
  it('escapes untrusted titles and links and keeps the button functional', () => {
    const html = mailTemplate(
      '<script>alert(1)</script>',
      '<p>Contenido</p>',
      'https://example.com/?a="&b=2',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('href="https://example.com/?a=&quot;&amp;b=2"');
    expect(html).toContain('cid:fangon-emblema');
  });
});
