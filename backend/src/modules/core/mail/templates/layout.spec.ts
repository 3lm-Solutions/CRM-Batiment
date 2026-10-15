import { accountCreatedMail } from './auth.templates';
import { escapeHtml } from './layout';

describe('mail templates', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    );
    expect(escapeHtml(null)).toBe('');
  });

  it('never inserts raw user input into the HTML', () => {
    const mail = accountCreatedMail({
      prenom: '<script>x</script>',
      nom: 'Dupont',
      email: 'a@b.fr',
      temporaryPassword: 'Abc123',
      appUrl: 'http://localhost:5173',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.text).toContain('Abc123');
  });
});
