import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'amortiza.me - Entenda seu financiamento. Planeje sua quitação.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const logo = await readFile(join(process.cwd(), 'public/brand/logo.png'));

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
          padding: 64, background: '#faf7fd', color: '#21142d', fontFamily: 'sans-serif',
          borderBottom: '16px solid #820AD1',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 52, fontWeight: 700 }}>
          {/* ImageResponse renders the local PNG directly, without an optimization request. */}
          <img src={`data:image/png;base64,${logo.toString('base64')}`} width={380} height={80} alt="amortiza.me" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 60, fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
          <span>Entenda seu financiamento.</span>
          <span style={{ color: '#820AD1' }}>Planeje sua quitação.</span>
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 28, color: '#64556f' }}>
          SAC e PRICE | Amortização | Custos da compra
        </div>
      </div>
    ),
    size,
  );
}
