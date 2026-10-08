export function validProfileImage(file: { name: string; size: number }, bytes: Uint8Array) {
  if (file.size > 5 * 1024 * 1024 || file.size === 0) return false;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value,index) => bytes[index] === value);
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  return extension === 'png' && png || (extension === 'jpg' || extension === 'jpeg') && jpeg || extension === 'webp' && webp;
}
