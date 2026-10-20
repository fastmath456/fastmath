type ZipEntry = { name: string; size: number; open: () => Promise<ReadableStream<Uint8Array>> };

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

// Store PDFs without recompressing them; only one source stream is open at a time.
// shortcut: archives over 4 GiB or 65,535 files require ZIP64 support.
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  const names = entries.map(entry => Buffer.from(entry.name, 'utf8'));
  const total = entries.reduce((sum, entry, index) => sum + entry.size + names[index].length * 2 + 92, 22);
  if (entries.length > 65535 || total > 0xffffffff || entries.some((entry, index) => !Number.isSafeInteger(entry.size) || entry.size < 0 || names[index].length > 65535)) throw new Error('ZIP64 is required');

  async function* archive() {
    const directory: Buffer[] = [];
    let offset = 0;
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index], name = names[index], start = offset;
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0x0808, 6); header.writeUInt16LE(33, 12); header.writeUInt16LE(name.length, 26);
      yield header; yield name; offset += header.length + name.length;
      const reader = (await entry.open()).getReader();
      let crc = 0xffffffff, size = 0, complete = false;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) { complete = true; break; }
          size += chunk.value.length;
          if (size > entry.size) throw new Error('Material size changed');
          for (const byte of chunk.value) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
          yield chunk.value;
        }
      } finally {
        if (!complete) await reader.cancel();
        reader.releaseLock();
      }
      if (size !== entry.size) throw new Error('Material size changed');
      crc = (crc ^ 0xffffffff) >>> 0;
      const descriptor = Buffer.alloc(16);
      descriptor.writeUInt32LE(0x08074b50, 0); descriptor.writeUInt32LE(crc, 4);
      descriptor.writeUInt32LE(size, 8); descriptor.writeUInt32LE(size, 12);
      yield descriptor; offset += size + descriptor.length;
      const record = Buffer.alloc(46);
      record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
      record.writeUInt16LE(0x0808, 8); record.writeUInt16LE(33, 14); record.writeUInt32LE(crc, 16);
      record.writeUInt32LE(size, 20); record.writeUInt32LE(size, 24);
      record.writeUInt16LE(name.length, 28); record.writeUInt32LE(start, 42);
      directory.push(record, name);
    }
    const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
    for (const part of directory) yield part;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directorySize, 12); end.writeUInt32LE(offset, 16);
    yield end;
  }
  const iterator = archive();
  return new ReadableStream({
    async pull(controller) {
      try {
        const result = await iterator.next();
        if (result.done) controller.close(); else controller.enqueue(result.value);
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return(undefined); },
  });
}
