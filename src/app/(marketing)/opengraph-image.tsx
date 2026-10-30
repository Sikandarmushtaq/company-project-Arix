import { ImageResponse } from 'next/og';

export const alt =
  'ArixCall — unlimited calling, bulk SMS and recording in one softphone';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Dynamically generated OG image. Next.js rasterises this React tree to PNG
// at build/request time using @vercel/og — no external image asset needed.
export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #121212 0%, #1e1e1e 50%, #000000 100%)',
        padding: 80,
        color: 'white',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background gradient blobs */}
      <div
        style={{
          position: 'absolute',
          top: -160,
          right: -160,
          width: 520,
          height: 520,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(255,101,66,0.55), transparent 70%)',
          filter: 'blur(40px)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          left: -160,
          width: 580,
          height: 580,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(255,181,71,0.42), transparent 70%)',
          filter: 'blur(40px)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 200,
          right: 240,
          width: 400,
          height: 400,
          borderRadius: 9999,
          background: 'radial-gradient(circle, rgba(229,72,31,0.4), transparent 70%)',
          filter: 'blur(40px)',
          display: 'flex',
        }}
      />

      {/* Brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: 'rgba(255,255,255,0.95)',
          zIndex: 10,
        }}
      >
        ArixCall
      </div>

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 'auto',
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            color: 'white',
            display: 'flex',
            flexWrap: 'wrap',
          }}
        >
          Calls. SMS. Recording.
        </div>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            marginTop: 8,
            backgroundImage: 'linear-gradient(90deg, #ffb547, #ff6542)',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'flex',
          }}
        >
          One dialer.
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            marginTop: 36,
            color: 'rgba(255,255,255,0.75)',
            display: 'flex',
          }}
        >
          The all-in-one cloud dialer for revenue teams.
        </div>
      </div>

      {/* Channel chips bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          right: 80,
          display: 'flex',
          gap: 12,
          zIndex: 10,
        }}
      >
        {[
          { label: 'Calls', color: '#ff6542' },
          { label: 'SMS', color: '#e5481f' },
          { label: 'REC', color: '#f59e0b' },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 16px',
              borderRadius: 9999,
              fontSize: 18,
              fontWeight: 700,
              color: 'white',
              background: c.color,
              boxShadow: `0 8px 24px ${c.color}55`,
            }}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>,
    { ...size }
  );
}
