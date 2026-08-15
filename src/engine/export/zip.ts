/** Minimal store-only (uncompressed) ZIP writer — enough for PNG sequences. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

export class ZipWriter {
  private chunks: Uint8Array[] = [];
  private entries: Entry[] = [];
  private offset = 0;

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.offset += bytes.length;
  }

  add(name: string, data: Uint8Array): void {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true); // stored
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    const entryOffset = this.offset;
    this.push(header);
    this.push(data);
    this.entries.push({ name, data, crc, offset: entryOffset });
  }

  finish(): Blob {
    const centralStart = this.offset;
    this.entries.forEach((entry) => {
      const nameBytes = new TextEncoder().encode(entry.name);
      const record = new Uint8Array(46 + nameBytes.length);
      const view = new DataView(record.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.data.length, true);
      view.setUint32(24, entry.data.length, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint32(42, entry.offset, true);
      record.set(nameBytes, 46);
      this.push(record);
    });
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, this.entries.length, true);
    view.setUint16(10, this.entries.length, true);
    view.setUint32(12, this.offset - centralStart, true);
    view.setUint32(16, centralStart, true);
    this.push(end);
    return new Blob(this.chunks as BlobPart[], { type: "application/zip" });
  }
}
