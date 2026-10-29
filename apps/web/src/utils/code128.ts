/** Build a local Code 128-B barcode SVG data URL. */
export function makeCode128DataUrl(value: string): string {
  const text = String(value ?? '').trim();
  if (!text) throw new Error('Kode barcode kosong. Isi ID Code terlebih dahulu.');
  const patterns = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
    '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
    '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
    '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
    '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
    '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
    '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
    '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
  ];
  const chars = Array.from(text).map(char => char.charCodeAt(0));
  if (chars.some(code => code < 32 || code > 126)) throw new Error('Code 128-B hanya mendukung karakter ASCII yang dapat dicetak.');
  const values = [104, ...chars.map(code => code - 32)];
  const checksum = values.reduce((sum, code, index) => sum + code * (index || 1), 0) % 103;
  const encoded = [...values, checksum, 106].map(code => patterns[code]);
  let x = 10;
  let bars = '';
  encoded.forEach(pattern => {
    let isBar = true;
    for (const digit of pattern) {
      const width = Number(digit) * 2;
      if (isBar) bars += `<rect x="${x}" y="4" width="${width}" height="64" fill="#111827"/>`;
      x += width;
      isBar = !isBar;
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 10}" height="84" viewBox="0 0 ${x + 10} 84"><rect width="100%" height="100%" fill="white"/>${bars}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
