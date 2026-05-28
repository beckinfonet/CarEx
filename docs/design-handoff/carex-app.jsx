// CarEx redesigned home — components

// ─── Design tokens ─────────────────────────────────────
const T = {
  bg: '#0A0C10',
  surface: '#13171F',
  surfaceHi: '#1A1F29',
  surfaceLo: '#0F1218',
  border: 'rgba(255,255,255,0.06)',
  borderHi: 'rgba(255,255,255,0.12)',
  text: '#F4F6FA',
  textMuted: 'rgba(244,246,250,0.62)',
  textFaint: 'rgba(244,246,250,0.38)',
  blue: '#4DA3FF',
  blueDim: 'rgba(77,163,255,0.16)',
  blueGlow: 'rgba(77,163,255,0.45)',
  gold: '#FFD166',
  goldGlow: 'rgba(255,209,102,0.32)',
  green: '#67E8B6',
  font: "'Manrope', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
};

// ─── Icons ─────────────────────────────────────────────
const Icon = ({ name, size = 20, stroke = 1.6, color = 'currentColor' }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'sliders': return <svg {...common}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14M18 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></svg>;
    case 'heart': return <svg {...common}><path d="M12 21s-7-4.35-9.5-9a5.5 5.5 0 0 1 9.5-5 5.5 5.5 0 0 1 9.5 5C19 16.65 12 21 12 21z"/></svg>;
    case 'heart-fill': return <svg {...common} fill={color}><path d="M12 21s-7-4.35-9.5-9a5.5 5.5 0 0 1 9.5-5 5.5 5.5 0 0 1 9.5 5C19 16.65 12 21 12 21z"/></svg>;
    case 'home': return <svg {...common}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'menu': return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="m9 6 6 6-6 6"/></svg>;
    case 'chevron-down': return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
    case 'gauge': return <svg {...common}><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M12 2a10 10 0 0 1 10 10h-3"/><path d="M2 12A10 10 0 0 1 12 2v3"/><path d="m15.5 8.5-1.8 2.8"/></svg>;
    case 'fuel': return <svg {...common}><path d="M3 22V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v18"/><path d="M3 14h11"/><path d="M14 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V8l-3-3"/></svg>;
    case 'flame': return <svg {...common}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c2 0 4-1.5 4-4 0-1.5-1-2-1-3 0-1 1-2 1-3 0-1.5-1.5-3-3-3 1 1.5 1 2.5 0 4-1 1.5-3 2-3 4 0 1 .5 1.5.5 2 0 1.5-1 2.5-1 2.5"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'reset': return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>;
    case 'options': return <svg {...common}><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>;
    case 'bookmark': return <svg {...common}><path d="M6 4h12v18l-6-4-6 4z"/></svg>;
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
    case 'star': return <svg {...common} fill={color}><path d="m12 3 2.6 5.6 6.4.7-4.8 4.4 1.3 6.3L12 17l-5.5 3 1.3-6.3L3 9.3l6.4-.7z"/></svg>;
    default: return null;
  }
};

// ─── Photo ─────────────────────────────────────────────
// Real photo via <img>, with graceful fallback to a striped placeholder.
const CarPhoto = ({ tone = 'cool', label, vibrant = false, ratio = '16/10', photo }) => {
  const [failed, setFailed] = React.useState(false);
  if (photo && !failed) {
    return (
      <div style={{
        position: 'relative', width: '100%', aspectRatio: ratio,
        borderRadius: 14, overflow: 'hidden',
        background: '#1a1e28',
      }}>
        <img
          src={photo}
          alt={label || ''}
          onError={() => setFailed(true)}
          loading="lazy"
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block',
            filter: vibrant ? 'saturate(1.18) contrast(1.04) brightness(1.03)' : 'none',
          }}
        />
        {/* subtle bottom vignette so overlays read */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
          background: 'linear-gradient(to top, rgba(10,12,16,0.55) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />
      </div>
    );
  }
  // fallback placeholder
  const palettes = {
    cool:  ['#3a4a63', '#1c2433'],
    warm:  ['#5a4435', '#2a1f18'],
    forest:['#2f4a3b', '#152019'],
    rose:  ['#5a3a4a', '#241620'],
    slate: ['#3d4555', '#1a1e28'],
    sun:   ['#5a4d28', '#241e10'],
  };
  const [c1, c2] = palettes[tone] || palettes.cool;
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: ratio,
      borderRadius: 14,
      overflow: 'hidden',
      background: `linear-gradient(160deg, ${c1} 0%, ${c2} 100%)`,
      filter: vibrant ? 'saturate(1.3) contrast(1.06) brightness(1.05)' : 'none',
    }}>
      {/* subtle diagonal stripes */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 12px)',
      }} />
      {/* horizon glow */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%',
        background: vibrant
          ? 'radial-gradient(ellipse at 50% 100%, rgba(255,209,102,0.20), transparent 70%)'
          : 'radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.07), transparent 70%)',
      }} />
      {/* placeholder icon — camera/photo glyph (basic shapes) */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8,
        color: 'rgba(255,255,255,0.32)',
      }}>
        <svg width="28" height="22" viewBox="0 0 28 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="4" width="25" height="16" rx="3" />
          <path d="M8 4l2-3h8l2 3" />
          <circle cx="14" cy="12" r="4.5" />
        </svg>
        {label && (
          <div style={{
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
          }}>{label}</div>
        )}
      </div>
    </div>
  );
};

// ─── Chip ──────────────────────────────────────────────
const Chip = ({ children, active, onClick, icon, compact = false, style = {} }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: compact ? 32 : 38,
    padding: compact ? '0 12px' : '0 16px',
    borderRadius: 999,
    background: active ? T.blueDim : T.surface,
    border: `1px solid ${active ? 'rgba(77,163,255,0.35)' : T.border}`,
    color: active ? T.blue : T.text,
    fontFamily: T.font,
    fontSize: compact ? 13 : 14,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.18s ease',
    ...style,
  }}>
    {icon}
    {children}
  </button>
);

// ─── Carousel card ─────────────────────────────────────
const CarouselCard = ({ car, promoted, intensity, showDisclosure, onFav, faved }) => {
  // Intensity 0..3 controls how much "pop" the promoted card gets.
  const glowSize = [0, 14, 22, 32][intensity] || 22;
  const glowAlpha = [0, 0.18, 0.32, 0.48][intensity] || 0.32;
  const scale = promoted ? [1, 1.0, 1.02, 1.04][intensity] || 1.02 : 1;
  const borderGrad = promoted
    ? `linear-gradient(155deg, rgba(255,209,102,${0.45 * (intensity/2 || 1)}) 0%, rgba(77,163,255,${0.3 * (intensity/2 || 1)}) 100%)`
    : 'transparent';

  return (
    <div style={{
      position: 'relative',
      scrollSnapAlign: 'start',
      flex: '0 0 auto',
      width: 172,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      transition: 'transform 0.25s ease',
      filter: promoted && intensity > 0 ? `drop-shadow(0 8px ${glowSize}px rgba(255,209,102,${glowAlpha}))` : 'none',
    }}>
      {/* gradient border wrapper */}
      <div style={{
        padding: promoted && intensity > 0 ? 1.5 : 0,
        borderRadius: 20,
        background: borderGrad,
      }}>
        <div style={{
          position: 'relative',
          background: promoted ? T.surfaceHi : T.surface,
          borderRadius: 18.5,
          padding: 8,
          border: promoted ? 'none' : `1px solid ${T.border}`,
          overflow: 'hidden',
        }}>
          {/* inner sheen for promoted */}
          {promoted && intensity > 0 && (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(circle at 50% -20%, rgba(255,209,102,0.10), transparent 60%)',
            }} />
          )}

          <div style={{ position: 'relative' }}>
            <CarPhoto tone={car.tone} label={car.short} vibrant={promoted} ratio="4/3" photo={car.photo} />

            {/* favorite button top-right */}
            <button onClick={(e) => { e.stopPropagation(); onFav(); }} style={{
              position: 'absolute', top: 6, right: 6,
              width: 28, height: 28, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'rgba(10,12,16,0.55)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: faved ? '#ff5d7a' : '#fff',
              cursor: 'pointer',
            }}>
              <Icon name={faved ? 'heart-fill' : 'heart'} size={14} />
            </button>

            {/* small fresh-listing dot */}
            <div style={{
              position: 'absolute', top: 8, left: 8,
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 999,
              background: 'rgba(10,12,16,0.55)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: T.green, textTransform: 'uppercase',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
              новое
            </div>

            {/* promoted micro-icon — decorative spark, NOT a label */}
            {promoted && intensity > 0 && (
              <div style={{
                position: 'absolute', bottom: 8, right: 8,
                width: 24, height: 24, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                background: 'linear-gradient(155deg, rgba(255,209,102,0.95), rgba(255,160,80,0.85))',
                color: '#1a1308',
                animation: 'shimmer 2.6s ease-in-out infinite',
                boxShadow: `0 0 12px rgba(255,209,102,0.5)`,
              }}>
                <Icon name="flame" size={12} stroke={2.2} />
              </div>
            )}
          </div>

          {/* info */}
          <div style={{ padding: '10px 4px 4px' }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: T.text,
              letterSpacing: '-0.015em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {car.make} {car.model}
            </div>
            <div style={{
              fontSize: 11, color: T.textMuted, marginTop: 2,
              fontFamily: T.fontMono, fontWeight: 500,
            }}>
              {car.year} · {car.km}
            </div>
            <div style={{
              marginTop: 6, fontSize: 16, fontWeight: 800,
              color: promoted ? T.gold : T.blue,
              fontFamily: T.fontMono,
              letterSpacing: '-0.02em',
            }}>
              ${car.price.toLocaleString('en-US')}
            </div>
          </div>

          {/* optional compliance microlabel */}
          {promoted && showDisclosure && (
            <div style={{
              position: 'absolute', bottom: 4, left: 8,
              fontSize: 8, color: T.textFaint,
              fontFamily: T.fontMono, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>реклама</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Vertical listing card ─────────────────────────────
// density: 'comfortable' | 'compact'
const ListingCard = ({ car, faved, onFav, density = 'comfortable' }) => {
  const isCompact = density === 'compact';
  const radius = isCompact ? 18 : 22;
  const photoRatio = isCompact ? '21/10' : '16/9';
  const padPhoto = isCompact ? '10px 12px 12px' : '14px 16px 16px';
  const titleSize = isCompact ? 15 : 17;
  const subSize = isCompact ? 12 : 13;
  const priceSize = isCompact ? 17 : 20;
  const chipGap = isCompact ? 10 : 12;

  return (
  <div style={{
    background: T.surface,
    borderRadius: radius,
    border: `1px solid ${T.border}`,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, border-color 0.2s ease',
  }}
  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.99)'}
  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  >
    <div style={{ position: 'relative' }}>
      <CarPhoto tone={car.tone} label={car.short} ratio={photoRatio} photo={car.photo} />
      {/* favorite */}
      <button onClick={(e) => { e.stopPropagation(); onFav(); }} style={{
        position: 'absolute', top: isCompact ? 8 : 10, right: isCompact ? 8 : 10,
        width: isCompact ? 32 : 36, height: isCompact ? 32 : 36, borderRadius: '50%',
        display: 'grid', placeItems: 'center',
        background: 'rgba(10,12,16,0.5)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: faved ? '#ff5d7a' : '#fff',
        cursor: 'pointer',
      }}>
        <Icon name={faved ? 'heart-fill' : 'heart'} size={isCompact ? 15 : 17} />
      </button>
      {/* time stamp */}
      <div style={{
        position: 'absolute', bottom: isCompact ? 8 : 10, left: isCompact ? 8 : 10,
        padding: '4px 9px', borderRadius: 999,
        background: 'rgba(10,12,16,0.55)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: isCompact ? 10 : 11, fontWeight: 600, color: T.text,
        fontFamily: T.fontMono,
        whiteSpace: 'nowrap',
      }}>{car.posted}</div>
    </div>

    <div style={{ padding: padPhoto }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: titleSize, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
            {car.make} {car.model}
          </div>
          <div style={{ fontSize: subSize, color: T.textMuted, marginTop: 2, fontFamily: T.fontMono, fontWeight: 500 }}>
            {car.year} · {car.body}
          </div>
        </div>
        <div style={{
          fontSize: priceSize, fontWeight: 800, color: T.blue,
          fontFamily: T.fontMono, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
        }}>
          ${car.price.toLocaleString('en-US')}
        </div>
      </div>

      {/* spec chips */}
      <div style={{ display: 'flex', gap: 6, marginTop: chipGap, flexWrap: 'wrap' }}>
        <SpecChip icon="gauge" label={car.km} compact={isCompact} />
        <SpecChip icon="fuel" label={car.fuel} compact={isCompact} />
        <SpecChip label={car.trans} compact={isCompact} />
      </div>
    </div>
  </div>
  );
};

const SpecChip = ({ icon, label, compact }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: compact ? 24 : 28, padding: compact ? '0 8px' : '0 10px',
    borderRadius: 999,
    background: T.surfaceLo,
    border: `1px solid ${T.border}`,
    fontSize: compact ? 11 : 12, fontWeight: 600, color: T.text,
    fontFamily: T.fontMono, letterSpacing: '-0.01em',
  }}>
    {icon && <Icon name={icon} size={compact ? 12 : 13} color={T.textMuted} />}
    {label}
  </div>
);

// ─── Header ────────────────────────────────────────────
const Header = ({ lang, setLang }) => (
  <div style={{
    position: 'sticky', top: 0, zIndex: 20,
    padding: '12px 18px 12px',
    background: 'rgba(10,12,16,0.78)',
    backdropFilter: 'blur(18px)',
    borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  }}>
    {/* avatar */}
    <div style={{
      width: 38, height: 38, borderRadius: '50%',
      background: 'linear-gradient(135deg, #4a5566 0%, #1c2433 100%)',
      border: `1.5px solid ${T.borderHi}`,
      display: 'grid', placeItems: 'center',
      flexShrink: 0,
    }}>
      <Icon name="user" size={18} color={T.textMuted} />
    </div>

    {/* wordmark */}
    <div style={{
      fontSize: 22, fontWeight: 800,
      letterSpacing: '-0.04em',
      color: T.text,
    }}>
      Car<span style={{ color: T.blue }}>Ex</span>
    </div>

    {/* lang switch */}
    <div style={{
      display: 'flex', gap: 2, padding: 3,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 999,
    }}>
      {['RU', 'EN'].map(L => (
        <button key={L} onClick={() => setLang(L)} style={{
          padding: '5px 11px', borderRadius: 999, border: 'none',
          background: lang === L ? T.blue : 'transparent',
          color: lang === L ? '#04101f' : T.textMuted,
          fontFamily: T.font, fontSize: 11, fontWeight: 800,
          letterSpacing: '0.04em',
          cursor: 'pointer',
        }}>{L}</button>
      ))}
    </div>
  </div>
);

// ─── Search & filters ──────────────────────────────────
const SearchBar = () => (
  <div style={{ padding: '14px 18px 8px', display: 'flex', gap: 10 }}>
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
      height: 50, padding: '0 16px',
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
    }}>
      <Icon name="search" size={18} color={T.textMuted} />
      <span style={{ color: T.textFaint, fontSize: 14, fontWeight: 500 }}>
        Марка, модель, ключевое слово
      </span>
    </div>
    <button style={{
      width: 50, height: 50, borderRadius: 16,
      background: T.blue, color: '#04101f',
      border: 'none', display: 'grid', placeItems: 'center',
      cursor: 'pointer', boxShadow: `0 8px 20px ${T.blueGlow}`,
    }}>
      <Icon name="sliders" size={20} stroke={2.2} />
    </button>
  </div>
);

const FilterRow = () => {
  const [active, setActive] = React.useState({});
  const filters = [
    { id: 'price', label: 'Цена' },
    { id: 'km', label: 'Пробег' },
    { id: 'year', label: 'Год' },
    { id: 'body', label: 'Кузов' },
    { id: 'trans', label: 'КПП' },
  ];
  return (
    <div className="no-scrollbar" style={{
      display: 'flex', gap: 8, padding: '6px 18px 14px',
      overflowX: 'auto',
    }}>
      {filters.map(f => (
        <Chip key={f.id}
          active={active[f.id]}
          onClick={() => setActive(s => ({ ...s, [f.id]: !s[f.id] }))}
          compact
        >
          {f.label}
          <Icon name="chevron-down" size={13} stroke={2.2} />
        </Chip>
      ))}
      <button onClick={() => setActive({})} style={{
        width: 32, height: 32, borderRadius: 999,
        background: T.surface,
        border: `1px solid ${T.border}`,
        color: T.textMuted,
        display: 'grid', placeItems: 'center',
        cursor: 'pointer', flexShrink: 0,
      }}>
        <Icon name="reset" size={15} />
      </button>
    </div>
  );
};

// ─── Section header ───────────────────────────────────
const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{
    padding: '6px 18px 12px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 12,
  }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{
        fontSize: 20, fontWeight: 800, color: T.text,
        letterSpacing: '-0.025em',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{title}</div>
      {subtitle && (
        <div style={{
          fontSize: 10, color: T.textMuted, marginTop: 3,
          fontFamily: T.fontMono, fontWeight: 600, letterSpacing: '0.06em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{subtitle}</div>
      )}
    </div>
    <div style={{ flexShrink: 0 }}>{action}</div>
  </div>
);

// ─── Bottom nav ───────────────────────────────────────
const BottomNav = ({ active, setActive }) => {
  const items = [
    { id: 'home', icon: 'home', label: 'Главная' },
    { id: 'search', icon: 'search', label: 'Поиск' },
    { id: 'fav', icon: 'heart', label: 'Избранное' },
    { id: 'more', icon: 'menu', label: 'Ещё' },
  ];
  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0,
      marginTop: 'auto',
      paddingBottom: 28, paddingTop: 8, paddingLeft: 8, paddingRight: 8,
      background: 'linear-gradient(to top, rgba(10,12,16,1) 60%, rgba(10,12,16,0))',
      zIndex: 30,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 64px 1fr 1fr',
          alignItems: 'center', gap: 4,
          height: 64, padding: '0 4px',
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 28,
          backdropFilter: 'blur(20px)',
        }}>
          {items.slice(0, 2).map(item => (
            <NavItem key={item.id} {...item} active={active === item.id} onClick={() => setActive(item.id)} />
          ))}
          <div /> {/* slot for FAB */}
          {items.slice(2).map(item => (
            <NavItem key={item.id} {...item} active={active === item.id} onClick={() => setActive(item.id)} />
          ))}
        </div>
        {/* FAB centered */}
        <button onClick={() => setActive('sell')} style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 60, height: 60, borderRadius: '50%',
          background: `linear-gradient(155deg, ${T.blue}, #2b7de8)`,
          border: '3px solid #0a0c10',
          color: '#04101f',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer',
          boxShadow: `0 10px 26px ${T.blueGlow}`,
        }} aria-label="Продать авто">
          <Icon name="plus" size={26} stroke={2.6} />
        </button>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    color: active ? T.blue : T.textMuted,
    fontFamily: T.font,
    padding: '6px 0',
  }}>
    <Icon name={icon} size={20} stroke={active ? 2.2 : 1.7} />
    <span style={{ fontSize: 10, fontWeight: active ? 700 : 600, letterSpacing: '-0.01em' }}>{label}</span>
  </button>
);

// ─── Mock data ────────────────────────────────────────
// Unsplash photo URLs — public CDN. Falls back to placeholder on error.
const U = (id, w = 600) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=80`;

const CARS_CAROUSEL = [
  { id: 'k5',   make: 'Kia',     model: 'K5',       short: 'kia-k5',     year: 2019, km: '194k км', price: 8200,  tone: 'slate',  photo: U('photo-1503376780353-7e6692767b70', 500) },
  { id: 'son',  make: 'Hyundai', model: 'Sonata',   short: 'sonata-22',  year: 2022, km: '32k км',  price: 18500, tone: 'cool',   photo: U('photo-1542362567-b07e54358753', 500), promoted: true },
  { id: 'car',  make: 'Kia',     model: 'Carnival', short: 'carnival-21',year: 2021, km: '348 км',  price: 11500, tone: 'forest', photo: U('photo-1568844293986-8d0400bd4745', 500) },
  { id: 'spo',  make: 'Kia',     model: 'Sportage', short: 'sportage',   year: 2020, km: '78k км',  price: 14200, tone: 'rose',   photo: U('photo-1605559424843-9e4c228bf1c2', 500) },
  { id: 'x5',   make: 'BMW',     model: 'X5',       short: 'bmw-x5-23',  year: 2023, km: '12k км',  price: 52000, tone: 'warm',   photo: U('photo-1555215695-3004980ad54e', 500), promoted: true },
  { id: 'mor',  make: 'Kia',     model: 'Morning',  short: 'morning',    year: 2019, km: '102k км', price: 4990,  tone: 'sun',    photo: U('photo-1494976388531-d1058494cdd8', 500) },
];

const CARS_LIST = [
  { id: 'k5l',  make: 'Kia',     model: 'K5',       short: 'kia-k5',     year: 2019, body: 'Седан',     km: '194 000 км', price: 8200,  fuel: 'Газ',     trans: 'Автомат', tone: 'slate',  posted: '2 ч назад', photo: U('photo-1606664515524-ed2f786a0bd6', 800) },
  { id: 'cal',  make: 'Kia',     model: 'Carnival', short: 'carnival-21',year: 2021, body: 'Минивэн',   km: '348 км',     price: 11500, fuel: 'Бензин',  trans: 'Автомат', tone: 'forest', posted: '5 ч назад', photo: U('photo-1583121274602-3e2820c69888', 800) },
  { id: 'tuc',  make: 'Hyundai', model: 'Tucson',   short: 'tucson',     year: 2020, body: 'Кроссовер', km: '89 200 км',  price: 16800, fuel: 'Дизель',  trans: 'Автомат', tone: 'cool',   posted: '8 ч назад', photo: U('photo-1552519507-da3b142c6e3d', 800) },
];

// ─── App ──────────────────────────────────────────────
const CarExApp = ({ t, density = 'comfortable' }) => {
  const [lang, setLang] = React.useState('RU');
  const [activeNav, setActiveNav] = React.useState('home');
  const [favs, setFavs] = React.useState({ son: true });

  const toggleFav = (id) => setFavs(f => ({ ...f, [id]: !f[id] }));

  // Apply promoted count override
  const carouselCars = React.useMemo(() => {
    return CARS_CAROUSEL.map((c, i) => {
      if (t.promotedCount === 0) return { ...c, promoted: false };
      if (t.promotedCount === 1) return { ...c, promoted: i === 1 };
      if (t.promotedCount === 3) return { ...c, promoted: i === 1 || i === 3 || i === 4 };
      return c; // default 2
    });
  }, [t.promotedCount]);

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      background: T.bg,
      color: T.text,
      fontFamily: T.font,
      letterSpacing: '-0.01em',
      position: 'relative',
    }}>
      {/* status-bar spacer */}
      <div style={{ height: 54 }} />

      <Header lang={lang} setLang={setLang} />
      <SearchBar />
      <FilterRow />

      <SectionHeader
        title="Свежие предложения"
        subtitle="ОБНОВЛЕНО · 248 АВТО"
        action={
          <button style={{
            background: 'transparent', border: 'none',
            color: T.textMuted, fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 2,
            cursor: 'pointer', fontFamily: T.font,
          }}>
            Все <Icon name="chevron-right" size={15} />
          </button>
        }
      />

      {/* Carousel */}
      <div className="no-scrollbar" style={{
        display: 'flex', gap: 12,
        padding: '4px 18px 18px',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      }}>
        {carouselCars.map(car => (
          <CarouselCard
            key={car.id}
            car={car}
            promoted={!!car.promoted}
            intensity={car.promoted ? (t.showFlameIcon ? t.promotedIntensity : Math.max(1, t.promotedIntensity)) : 0}
            showDisclosure={t.showDisclosure}
            faved={!!favs[car.id]}
            onFav={() => toggleFav(car.id)}
          />
        ))}
        {/* spacer to scroll the last card into view nicely */}
        <div style={{ flex: '0 0 4px' }} />
      </div>

      <SectionHeader
        title="Похожее рядом"
        subtitle="ПО ДАТЕ ДОБАВЛЕНИЯ"
        action={
          <button style={{
            background: 'transparent', border: 'none',
            color: T.textMuted, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: T.font,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: 0,
          }}>
            <Icon name="options" size={16} />
          </button>
        }
      />

      <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: density === 'compact' ? 10 : 14 }}>
        {CARS_LIST.map(car => (
          <ListingCard key={car.id} car={car} faved={!!favs[car.id]} onFav={() => toggleFav(car.id)} density={density} />
        ))}
      </div>

      <BottomNav active={activeNav} setActive={setActiveNav} />
    </div>
  );
};

// ─── Tweaks ───────────────────────────────────────────
const CarExTweaks = ({ t, setTweak }) => {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Promoted listings · visual treatment">
        <TweakSlider
          label="Intensity"
          value={t.promotedIntensity} min={0} max={3} step={1}
          onChange={(v) => setTweak('promotedIntensity', v)}
        />
        <TweakRadio
          label="Promoted count"
          value={String(t.promotedCount)}
          options={['0', '1', '2', '3']}
          onChange={(v) => setTweak('promotedCount', parseInt(v))}
        />
        <TweakToggle
          label="Ember icon accent"
          value={t.showFlameIcon}
          onChange={(v) => setTweak('showFlameIcon', v)}
        />
      </TweakSection>

      <TweakSection label="Disclosure (compliance)">
        <TweakToggle
          label='Show "Реклама" microlabel'
          value={t.showDisclosure}
          onChange={(v) => setTweak('showDisclosure', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
};

// expose to other scripts
Object.assign(window, { CarExApp, CarExTweaks, T });
