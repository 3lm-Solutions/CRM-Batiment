import { detectFileType, sanitizeFileName } from './file-type';

const withHeader = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('detectFileType', () => {
  it('recognises the accepted formats by their first bytes', () => {
    expect(detectFileType(withHeader([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(detectFileType(withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe('image/png');
    expect(detectFileType(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1'))?.mime).toBe('image/webp');
    expect(detectFileType(Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1'))?.mime).toBe('application/pdf');
  });

  it('refuses everything else, whatever the name or declared type', () => {
    expect(detectFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectFileType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectFileType(Buffer.from('MZ executable padding....'))).toBeNull();
    expect(detectFileType(Buffer.alloc(4))).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('keeps only a harmless display name', () => {
    expect(sanitizeFileName('../../etc/passwd', 'x')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\a\\photo "1".jpg', 'x')).toBe('photo 1.jpg');
    expect(sanitizeFileName('', 'fichier.pdf')).toBe('fichier.pdf');
    expect(sanitizeFileName('a'.repeat(300), 'x')).toHaveLength(150);
  });
});
