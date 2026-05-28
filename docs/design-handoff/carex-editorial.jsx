// CarEx — Editorial / Photo-forward design (Option 3)
// Goes big on photography, uses a hero rotator (natural promoted slot),
// curated shelves with "match score" and price-vs-market intelligence.

const E = {
  bg: '#08090C',
  surface: '#13151B',
  surfaceHi: '#1C1F28',
  surfaceLo: '#0E1015',
  border: 'rgba(255,255,255,0.06)',
  borderHi: 'rgba(255,255,255,0.14)',
  text: '#F6F7FB',
  textMuted: 'rgba(246,247,251,0.62)',
  textFaint: 'rgba(246,247,251,0.38)',
  blue: '#4DA3FF',
  blueDeep: '#1C5FC4',
  blueGlow: 'rgba(77,163,255,0.42)',
  gold: '#FFD166',
  goldGlow: 'rgba(255,209,102,0.40)',
  green: '#67E8B6',
  red: '#FF7A8E',
  font: "'Manrope', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
};

// Editorial hero — one big featured car with overlay info
const HeroFeatured = ({ car, promoted, intensity = 2, showDisclosure }) => {
  const glowAlpha = [0, 0.16, 0.30, 0.45][intensity] || 0.30;
  return (
    <div style={{ position: 'relative', padding: '0 14px' }}>
      {/* gold halo behind */}
      {promoted && intensity > 0 && (
        <div style={{
          position: 'absolute', inset: '12px 28px',
          borderRadius: 28,
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,209,102,${glowAlpha}) 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        position: 'relative',
        borderRadius: 24,
        overflow: 'hidden',
        background: E.surfaceHi,
        border: `1px solid ${promoted ? 'rgba(255,209,102,0.24)' : E.border}`,
        boxShadow: promoted && intensity > 0
          ? `0 20px 50px rgba(255,209,102,${glowAlpha * 0.6})`
          : '0 12px 30px rgba(0,0,0,0.5)',
      }}>
        <div style={{ position: 'relative', aspectRatio: '5/4', background: '#1a1e28' }}>
          <img src={car.photo} alt={car.model} style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            filter: promoted ? 'saturate(1.16) contrast(1.04) brightness(1.03)' : 'saturate(1.05)',
          }}/>
          {/* gradient overlays */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(8,9,12,0.0) 35%, rgba(8,9,12,0.55) 75%, rgba(8,9,12,0.95) 100%)',
          }}/>

          {/* top row: page indicator + heart */}
          <div style={{
            position: 'absolute', top: 16, left: 16, right: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999,
              background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
              border: `1px solid rgba(255,255,255,0.12)`,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: E.text,
              fontFamily: E.font,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: E.green, boxShadow: `0 0 6px ${E.green}` }}/>
              Сегодня
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  width: i === 1 ? 22 : 6, height: 4, borderRadius: 999,
                  background: i === 1 ? E.text : 'rgba(255,255,255,0.35)',
                  transition: 'width .3s',
                }}/>
              ))}
            </div>
          </div>

          {/* promoted micro-icon (decorative, NOT label) */}
          {promoted && intensity > 0 && (
            <div style={{
              position: 'absolute', top: 56, right: 16,
              width: 30, height: 30, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'linear-gradient(155deg, rgba(255,209,102,0.95), rgba(255,160,80,0.85))',
              color: '#1a1308',
              animation: 'shimmer 2.6s ease-in-out infinite',
              boxShadow: '0 0 14px rgba(255,209,102,0.55)',
            }}>
              <Icon name="flame" size={14} stroke={2.2} />
            </div>
          )}

          {/* big info block bottom */}
          <div style={{
            position: 'absolute', left: 18, right: 18, bottom: 18,
            color: E.text,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: promoted ? E.gold : E.blue,
              fontFamily: E.font, marginBottom: 6,
            }}>
              {car.tagline || 'Свежее предложение'}
            </div>
            <div style={{
              fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em',
              lineHeight: 1.05, marginBottom: 4,
            }}>
              {car.make} {car.model}
            </div>
            <div style={{
              fontSize: 13, color: E.textMuted, fontFamily: E.fontMono,
              fontWeight: 500, marginBottom: 14,
            }}>
              {car.year} · {car.km} · {car.body}
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div style={{
                  fontSize: 30, fontWeight: 800,
                  fontFamily: E.fontMono, letterSpacing: '-0.03em',
                  color: E.text, lineHeight: 1,
                }}>
                  ${car.price.toLocaleString('en-US')}
                </div>
                {car.priceDelta && (
                  <div style={{
                    marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: 'rgba(103,232,182,0.12)',
                    border: '1px solid rgba(103,232,182,0.28)',
                    color: E.green, fontSize: 10.5, fontWeight: 700,
                    fontFamily: E.fontMono, letterSpacing: '-0.005em',
                  }}>
                    ↓ ниже рынка на ${car.priceDelta}
                  </div>
                )}
              </div>
              <button style={{
                height: 44, padding: '0 18px',
                borderRadius: 14,
                background: E.text, color: '#08090C',
                border: 'none', fontFamily: E.font,
                fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em',
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                Смотреть
                <Icon name="chevron-right" size={16} stroke={2.4} />
              </button>
            </div>
          </div>

          {promoted && showDisclosure && (
            <div style={{
              position: 'absolute', top: 56, left: 16,
              fontSize: 8, color: 'rgba(255,255,255,0.5)',
              fontFamily: E.fontMono, letterSpacing: '0.10em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>реклама</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Smart shelf — horizontal cards with match-score / price-intel
const SmartShelf = ({ title, kicker, cars, promotedIds, intensity, showDisclosure, onFav, favs }) => (
  <div>
    <div style={{ padding: '18px 18px 12px' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: E.blue,
        fontFamily: E.font, marginBottom: 5,
      }}>{kicker}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, letterSpacing: '-0.028em',
        color: E.text, lineHeight: 1.05,
      }}>{title}</div>
    </div>
    <div className="no-scrollbar" style={{
      display: 'flex', gap: 11,
      padding: '0 18px 4px',
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
    }}>
      {cars.map(car => {
        const isPromo = promotedIds.includes(car.id);
        return (
          <ShelfCard
            key={car.id}
            car={car}
            promoted={isPromo}
            intensity={isPromo ? intensity : 0}
            showDisclosure={showDisclosure}
            faved={!!favs[car.id]}
            onFav={() => onFav(car.id)}
          />
        );
      })}
      <div style={{ flex: '0 0 4px' }}/>
    </div>
  </div>
);

const ShelfCard = ({ car, promoted, intensity, showDisclosure, faved, onFav }) => {
  const glowAlpha = [0, 0.18, 0.34, 0.50][intensity] || 0.34;
  const scale = promoted ? ([1, 1, 1.02, 1.04][intensity] || 1.02) : 1;
  return (
    <div style={{
      flex: '0 0 auto', width: 168,
      scrollSnapAlign: 'start',
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      transition: 'transform .25s ease',
      filter: promoted && intensity > 0 ? `drop-shadow(0 8px 22px rgba(255,209,102,${glowAlpha}))` : 'none',
    }}>
      <div style={{
        padding: promoted && intensity > 0 ? 1.5 : 0,
        borderRadius: 18,
        background: promoted && intensity > 0
          ? `linear-gradient(155deg, rgba(255,209,102,${0.55 * (intensity/2 || 1)}) 0%, rgba(77,163,255,${0.32 * (intensity/2 || 1)}) 100%)`
          : 'transparent',
      }}>
        <div style={{
          position: 'relative',
          background: promoted ? E.surfaceHi : E.surface,
          borderRadius: 16.5,
          overflow: 'hidden',
          border: promoted ? 'none' : `1px solid ${E.border}`,
        }}>
          {/* photo */}
          <div style={{ position: 'relative', aspectRatio: '4/3', background: '#1a1e28' }}>
            <img src={car.photo} alt={car.model} style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: promoted ? 'saturate(1.18) contrast(1.04) brightness(1.03)' : 'none',
            }}/>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.45) 100%)',
            }}/>
            <button onClick={(e)=>{e.stopPropagation(); onFav();}} style={{
              position: 'absolute', top: 8, right: 8,
              width: 28, height: 28, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: faved ? '#ff5d7a' : '#fff',
              cursor: 'pointer',
            }}>
              <Icon name={faved ? 'heart-fill' : 'heart'} size={13} />
            </button>

            {/* match score top-left */}
            {car.match && !promoted && (
              <div style={{
                position: 'absolute', top: 8, left: 8,
                padding: '3px 8px', borderRadius: 999,
                background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(77,163,255,0.32)',
                color: E.blue, fontSize: 10, fontWeight: 800,
                fontFamily: E.font, letterSpacing: '-0.005em',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="sparkle" size={9} stroke={2.5} />
                {car.match}%
              </div>
            )}

            {/* promoted micro */}
            {promoted && intensity > 0 && (
              <div style={{
                position: 'absolute', bottom: 8, right: 8,
                width: 22, height: 22, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                background: 'linear-gradient(155deg, rgba(255,209,102,0.95), rgba(255,160,80,0.85))',
                color: '#1a1308',
                boxShadow: '0 0 10px rgba(255,209,102,0.5)',
                animation: 'shimmer 2.6s ease-in-out infinite',
              }}>
                <Icon name="flame" size={11} stroke={2.3} />
              </div>
            )}

            {/* price overlay */}
            <div style={{
              position: 'absolute', left: 10, bottom: 10,
              color: '#fff',
              fontSize: 16, fontWeight: 800,
              fontFamily: E.fontMono, letterSpacing: '-0.02em',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>
              ${car.price.toLocaleString('en-US')}
            </div>
          </div>
          {/* info */}
          <div style={{ padding: '10px 11px 12px' }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: E.text,
              letterSpacing: '-0.018em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{car.make} {car.model}</div>
            <div style={{
              fontSize: 10.5, color: E.textMuted, marginTop: 2,
              fontFamily: E.fontMono, fontWeight: 500,
            }}>
              {car.year} · {car.km}
            </div>
            {car.priceDelta && !promoted && (
              <div style={{
                marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 700, color: E.green,
                fontFamily: E.fontMono, letterSpacing: '-0.005em',
              }}>
                ↓ ${car.priceDelta} ниже рынка
              </div>
            )}
          </div>

          {promoted && showDisclosure && (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              fontSize: 8, color: 'rgba(255,255,255,0.55)',
              fontFamily: E.fontMono, letterSpacing: '0.10em',
              textTransform: 'uppercase', fontWeight: 600,
              padding: '2px 6px', borderRadius: 4,
              background: 'rgba(8,9,12,0.4)', backdropFilter: 'blur(6px)',
            }}>реклама</div>
          )}
        </div>
      </div>
    </div>
  );
};

// BIG feed card — used for PROMOTED (paid) listings in the home feed.
// Mirrors the search-results hero treatment: hero photo with info overlaid,
// match-score chip, heart, flame ember, and a white "Открыть" CTA.
const BigFeedCard = ({ car, promoted, intensity, showDisclosure, faved, onFav }) => {
  const glowAlpha = [0, 0.16, 0.30, 0.45][intensity] || 0.30;
  return (
    <div style={{ position: 'relative' }}>
      {promoted && intensity > 0 && (
        <div style={{
          position: 'absolute', inset: '8px 12px',
          borderRadius: 24,
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,209,102,${glowAlpha}) 0%, transparent 70%)`,
          filter: 'blur(18px)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{
        position: 'relative',
        borderRadius: 22,
        overflow: 'hidden',
        background: E.surfaceHi,
        border: `1px solid ${promoted ? 'rgba(255,209,102,0.24)' : E.border}`,
        boxShadow: promoted && intensity > 0
          ? `0 14px 40px rgba(255,209,102,${glowAlpha * 0.55})`
          : '0 8px 22px rgba(0,0,0,0.4)',
      }}>
        <div style={{ position: 'relative', aspectRatio: '16/11', background: '#1a1e28' }}>
          <img src={car.photo} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            filter: promoted ? 'saturate(1.16) contrast(1.04) brightness(1.03)' : 'saturate(1.05)',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(8,9,12,0) 40%, rgba(8,9,12,0.92) 100%)',
          }}/>

          {/* match score */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            padding: '5px 11px', borderRadius: 999,
            background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(77,163,255,0.38)',
            color: E.blue, fontSize: 12, fontWeight: 800,
            fontFamily: E.font,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap',
          }}>
            <Icon name="sparkle" size={11} stroke={2.4}/>
            {car.match}% совпадение
          </div>

          {/* favorite */}
          <button onClick={(e)=>{e.stopPropagation();onFav();}} style={{
            position: 'absolute', top: 12, right: 12,
            width: 36, height: 36, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: faved ? '#ff5d7a' : '#fff',
            cursor: 'pointer',
          }}>
            <Icon name={faved ? 'heart-fill' : 'heart'} size={16}/>
          </button>

          {/* promoted ember */}
          {promoted && intensity > 0 && (
            <div style={{
              position: 'absolute', top: 52, right: 12,
              width: 28, height: 28, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'linear-gradient(155deg, rgba(255,209,102,0.95), rgba(255,160,80,0.85))',
              color: '#1a1308',
              animation: 'shimmer 2.6s ease-in-out infinite',
              boxShadow: '0 0 12px rgba(255,209,102,0.5)',
            }}>
              <Icon name="flame" size={13} stroke={2.3}/>
            </div>
          )}

          {/* info overlay */}
          <div style={{
            position: 'absolute', left: 16, right: 16, bottom: 16,
            color: E.text,
          }}>
            <div style={{
              fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}>
              {car.make} {car.model}
            </div>
            <div style={{
              fontSize: 12, color: E.textMuted, marginTop: 3,
              fontFamily: E.fontMono, fontWeight: 600,
              letterSpacing: '-0.005em',
            }}>
              {car.year} · {car.km} · {car.body}
            </div>
            <div style={{
              marginTop: 12,
              display: 'flex', alignItems: 'flex-end',
              justifyContent: 'space-between', gap: 10,
            }}>
              <div>
                <div style={{
                  fontSize: 24, fontWeight: 800,
                  fontFamily: E.fontMono, letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>
                  ${car.price.toLocaleString('en-US')}
                </div>
                {car.priceDelta > 0 && (
                  <div style={{
                    marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 999,
                    background: 'rgba(103,232,182,0.14)',
                    border: '1px solid rgba(103,232,182,0.3)',
                    color: E.green, fontSize: 10.5, fontWeight: 700,
                    fontFamily: E.fontMono, letterSpacing: '-0.005em',
                    whiteSpace: 'nowrap',
                  }}>
                    ↓ ниже рынка на ${car.priceDelta.toLocaleString('en-US')}
                  </div>
                )}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '10px 14px', borderRadius: 12,
                background: E.text, color: '#08090C',
                fontSize: 13, fontWeight: 800,
                letterSpacing: '-0.01em',
              }}>
                Открыть
                <Icon name="chevron-right" size={14} stroke={2.4}/>
              </div>
            </div>
          </div>

          {promoted && showDisclosure && (
            <div style={{
              position: 'absolute', top: 52, left: 14,
              fontSize: 8, color: 'rgba(255,255,255,0.55)',
              fontFamily: E.fontMono, letterSpacing: '0.10em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>реклама</div>
          )}
        </div>
      </div>
    </div>
  );
};

// SMALL feed card — used for REGULAR (organic) listings in the home feed.
// Horizontal layout: square photo left, info right. Mirrors the search-results
// list card so big-vs-small reads as paid-vs-organic everywhere.
const SmallFeedCard = ({ car, faved, onFav }) => (
  <div style={{ position: 'relative' }}>
    <div style={{
      display: 'grid', gridTemplateColumns: '124px 1fr',
      gap: 0,
      background: E.surface,
      borderRadius: 16.5,
      overflow: 'hidden',
      border: `1px solid ${E.border}`,
      cursor: 'pointer',
    }}>
      <div style={{ position: 'relative', aspectRatio: '1/1', background: '#1a1e28' }}>
        <img src={car.photo} alt="" style={{
          width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        }}/>
        <div style={{
          position: 'absolute', top: 7, left: 7,
          padding: '2px 7px', borderRadius: 999,
          background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(77,163,255,0.32)',
          color: E.blue, fontSize: 10, fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontFamily: E.font,
        }}>
          <Icon name="sparkle" size={8} stroke={2.6}/>
          {car.match}%
        </div>
      </div>
      <div style={{
        padding: '11px 13px 12px',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
        minWidth: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: E.text,
              letterSpacing: '-0.02em', lineHeight: 1.15,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {car.make} {car.model}
            </div>
            <div style={{
              fontSize: 11, color: E.textMuted, marginTop: 2,
              fontFamily: E.fontMono, fontWeight: 600,
              letterSpacing: '-0.005em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {car.year} · {car.body}
            </div>
          </div>
          <button onClick={(e)=>{e.stopPropagation();onFav();}} style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'grid', placeItems: 'center',
            background: 'transparent', border: 'none',
            color: faved ? '#ff5d7a' : E.textMuted,
            cursor: 'pointer', flexShrink: 0,
            marginTop: -2, marginRight: -4,
          }}>
            <Icon name={faved ? 'heart-fill' : 'heart'} size={15} stroke={2} />
          </button>
        </div>
        <div style={{
          display: 'flex', gap: 10, marginTop: 6,
          fontSize: 10.5, color: E.textMuted,
          fontFamily: E.fontMono, fontWeight: 600,
          letterSpacing: '-0.005em',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="gauge" size={11} color={E.textFaint} stroke={1.8}/>
            {car.km}
          </span>
        </div>
        <div style={{
          marginTop: 10,
          display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{
            fontSize: 17, fontWeight: 800,
            color: E.text,
            fontFamily: E.fontMono, letterSpacing: '-0.02em',
          }}>
            ${car.price.toLocaleString('en-US')}
          </div>
          {car.priceDelta > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, fontWeight: 700, color: E.green,
              fontFamily: E.fontMono, letterSpacing: '-0.005em',
              whiteSpace: 'nowrap',
            }}>
              ↓ ${car.priceDelta.toLocaleString('en-US')}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

// (legacy) Vertical feed card — photo on top, info strip below.
// Kept for reference; no longer used in the feed which now mixes Big + Small.
const FeedCard = ({ car, promoted, intensity, showDisclosure, faved, onFav }) => {
  const glowAlpha = [0, 0.14, 0.26, 0.40][intensity] || 0.26;
  return (
    <div style={{
      position: 'relative',
      filter: promoted && intensity > 0 ? `drop-shadow(0 10px 22px rgba(255,209,102,${glowAlpha}))` : 'none',
    }}>
      <div style={{
        padding: promoted && intensity > 0 ? 1.5 : 0,
        borderRadius: 18,
        background: promoted && intensity > 0
          ? `linear-gradient(155deg, rgba(255,209,102,${0.50 * (intensity/2 || 1)}) 0%, rgba(77,163,255,${0.28 * (intensity/2 || 1)}) 100%)`
          : 'transparent',
      }}>
        <div style={{
          position: 'relative',
          background: promoted ? E.surfaceHi : E.surface,
          borderRadius: 16.5,
          overflow: 'hidden',
          border: promoted ? 'none' : `1px solid ${E.border}`,
          cursor: 'pointer',
        }}>
          {/* Photo */}
          <div style={{ position: 'relative', aspectRatio: '16/10', background: '#1a1e28' }}>
            <img src={car.photo} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: promoted ? 'saturate(1.16) contrast(1.04) brightness(1.03)' : 'saturate(1.04)',
            }}/>

            {/* match score */}
            {!promoted && (
              <div style={{
                position: 'absolute', top: 10, left: 10,
                padding: '3px 8px', borderRadius: 999,
                background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(77,163,255,0.32)',
                color: E.blue, fontSize: 10.5, fontWeight: 800,
                fontFamily: E.font,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="sparkle" size={9} stroke={2.5}/>
                {car.match}%
              </div>
            )}

            {/* favorite */}
            <button onClick={(e)=>{e.stopPropagation(); onFav();}} style={{
              position: 'absolute', top: 10, right: 10,
              width: 30, height: 30, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: faved ? '#ff5d7a' : '#fff',
              cursor: 'pointer',
            }}>
              <Icon name={faved ? 'heart-fill' : 'heart'} size={14}/>
            </button>

            {/* promoted ember */}
            {promoted && intensity > 0 && (
              <div style={{
                position: 'absolute', bottom: 10, right: 10,
                width: 24, height: 24, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                background: 'linear-gradient(155deg, rgba(255,209,102,0.95), rgba(255,160,80,0.85))',
                color: '#1a1308',
                boxShadow: '0 0 10px rgba(255,209,102,0.5)',
                animation: 'shimmer 2.6s ease-in-out infinite',
              }}>
                <Icon name="flame" size={11} stroke={2.3}/>
              </div>
            )}

            {/* promoted alt: match chip swapped for nothing on photo */}
            {promoted && showDisclosure && (
              <div style={{
                position: 'absolute', top: 10, left: 10,
                fontSize: 8, color: 'rgba(255,255,255,0.55)',
                fontFamily: E.fontMono, letterSpacing: '0.10em',
                textTransform: 'uppercase', fontWeight: 600,
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(8,9,12,0.4)', backdropFilter: 'blur(6px)',
              }}>реклама</div>
            )}
          </div>

          {/* Info strip — separated from photo, single row */}
          <div style={{
            padding: '12px 14px 13px',
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 15, fontWeight: 800, color: E.text,
                letterSpacing: '-0.022em', lineHeight: 1.15,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {car.make} {car.model}
              </div>
              <div style={{
                fontSize: 11, color: E.textMuted, marginTop: 3,
                fontFamily: E.fontMono, fontWeight: 600,
                letterSpacing: '-0.005em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {car.year} · {car.km} · {car.body}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 800,
                fontFamily: E.fontMono, letterSpacing: '-0.022em',
                color: promoted ? E.gold : E.text,
                lineHeight: 1,
              }}>
                ${car.price.toLocaleString('en-US')}
              </div>
              {car.priceDelta > 0 && (
                <div style={{
                  marginTop: 5,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, fontWeight: 700, color: E.green,
                  fontFamily: E.fontMono, letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap',
                }}>
                  ↓ ${car.priceDelta.toLocaleString('en-US')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeedLoader = () => (
  <div style={{
    padding: '18px 0 6px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  }}>
    <div style={{ display: 'flex', gap: 5 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: E.textFaint,
          animation: `dotPulse 1.2s ease-in-out ${i * 0.16}s infinite`,
        }}/>
      ))}
    </div>
    <div style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: E.textFaint,
      fontFamily: E.font,
    }}>Подбираем ещё…</div>
    <style>{`
      @keyframes dotPulse {
        0%, 100% { opacity: 0.35; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.3); }
      }
    `}</style>
  </div>
);

// Floating search pill (top of scroll)
const FloatingSearch = () => (
  <div style={{
    position: 'sticky', top: 12, zIndex: 30,
    margin: '12px 18px 0',
    padding: '0 6px 0 18px',
    height: 48,
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(19,21,27,0.85)',
    backdropFilter: 'blur(20px)',
    border: `1px solid ${E.borderHi}`,
    borderRadius: 999,
    boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
  }}>
    <Icon name="search" size={17} color={E.text} stroke={2.0} />
    <span style={{ flex: 1, color: E.textFaint, fontSize: 14, fontWeight: 500 }}>
      Что вы ищете?
    </span>
    <button style={{
      width: 36, height: 36, borderRadius: '50%',
      background: E.blue, color: '#04101f',
      border: 'none', display: 'grid', placeItems: 'center',
      cursor: 'pointer',
    }}>
      <Icon name="sliders" size={16} stroke={2.4} />
    </button>
  </div>
);

// Greeting header
const Greeting = () => (
  <div style={{ padding: '16px 22px 6px' }}>
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: E.textMuted,
      fontFamily: E.font, marginBottom: 6,
    }}>
      Доброе утро · Москва
    </div>
    <div style={{
      fontSize: 30, fontWeight: 800, letterSpacing: '-0.035em',
      color: E.text, lineHeight: 1.02,
    }}>
      Найдём ваше<br/>идеальное авто.
    </div>
    <div style={{
      marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 999,
        background: E.surface, border: `1px solid ${E.border}`,
        fontSize: 12, fontWeight: 700, color: E.text,
        fontFamily: E.font, letterSpacing: '-0.005em',
      }}>
        <Icon name="bookmark" size={12} stroke={2.2} color={E.blue} />
        3 поиска
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 999,
        background: 'rgba(77,163,255,0.12)', border: `1px solid rgba(77,163,255,0.28)`,
        fontSize: 12, fontWeight: 700, color: E.blue,
        fontFamily: E.font, letterSpacing: '-0.005em',
      }}>
        <Icon name="sparkle" size={12} stroke={2.4} />
        12 совпадений
      </span>
    </div>
  </div>
);

// Bottom dock — matches the nav from Options A/B (labels + circular FAB)
const EditorialDock = () => {
  const [active, setActive] = React.useState('home');
  const items = [
    { id: 'home',   icon: 'home',   label: 'Главная' },
    { id: 'search', icon: 'search', label: 'Поиск' },
    { id: 'fav',    icon: 'heart',  label: 'Избранное' },
    { id: 'more',   icon: 'menu',   label: 'Ещё' },
  ];
  const navItem = (item) => (
    <button key={item.id} onClick={() => setActive(item.id)} style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      color: active === item.id ? E.blue : E.textMuted,
      fontFamily: E.font,
      padding: '6px 0',
    }}>
      <Icon name={item.icon} size={20} stroke={active === item.id ? 2.2 : 1.7} />
      <span style={{
        fontSize: 10, fontWeight: active === item.id ? 700 : 600,
        letterSpacing: '-0.01em',
      }}>{item.label}</span>
    </button>
  );
  return (
    <div style={{
      position: 'sticky', bottom: 0, marginTop: 'auto',
      padding: '8px 8px 28px',
      background: 'linear-gradient(to top, rgba(8,9,12,1) 60%, rgba(8,9,12,0))',
      zIndex: 30,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 64px 1fr 1fr',
          alignItems: 'center', gap: 4,
          height: 64, padding: '0 4px',
          background: E.surface,
          border: `1px solid ${E.border}`,
          borderRadius: 28,
          backdropFilter: 'blur(20px)',
        }}>
          {items.slice(0, 2).map(navItem)}
          <div />
          {items.slice(2).map(navItem)}
        </div>
        <button onClick={() => setActive('sell')} style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 60, height: 60, borderRadius: '50%',
          background: `linear-gradient(155deg, ${E.blue}, ${E.blueDeep})`,
          border: '3px solid #08090C',
          color: '#04101f',
          display: 'grid', placeItems: 'center',
          cursor: 'pointer',
          boxShadow: `0 10px 26px ${E.blueGlow}`,
        }} aria-label="Продать авто">
          <Icon name="plus" size={26} stroke={2.6} />
        </button>
      </div>
    </div>
  );
};

// Mock data with photos + intel
const E_HERO_CARS = [
  {
    id: 'hero-x5', make: 'BMW', model: 'X5', year: 2023, km: '12 000 км', body: 'Кроссовер',
    price: 52000, tagline: 'Премиум сегодня',
    photo: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=900&auto=format&fit=crop&q=85',
    promoted: true,
  },
];

const E_BUDGET_CARS = [
  { id: 'b1', make: 'Kia', model: 'K5',       year: 2019, km: '194k км', price: 8200,  match: 92, photo: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80' },
  { id: 'b2', make: 'Hyundai', model: 'Sonata',   year: 2022, km: '32k км',  price: 18500, match: 88, priceDelta: 1200, photo: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=500&auto=format&fit=crop&q=80' },
  { id: 'b3', make: 'Kia', model: 'Sportage', year: 2020, km: '78k км',  price: 14200, match: 84, photo: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=500&auto=format&fit=crop&q=80' },
  { id: 'b4', make: 'Hyundai', model: 'Tucson',   year: 2020, km: '89k км',  price: 16800, match: 81, priceDelta: 800, photo: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500&auto=format&fit=crop&q=80' },
  { id: 'b5', make: 'Mazda', model: 'CX-5',     year: 2021, km: '54k км',  price: 19500, match: 78, photo: 'https://images.unsplash.com/photo-1605559911160-a3d95d213904?w=500&auto=format&fit=crop&q=80' },
];

const E_FRESH_CARS = [
  { id: 'f1', make: 'Audi', model: 'Q5',       year: 2021, km: '41k км', price: 38500, photo: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=500&auto=format&fit=crop&q=80' },
  { id: 'f2', make: 'Mercedes', model: 'C-Class',  year: 2022, km: '24k км', price: 42000, photo: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=500&auto=format&fit=crop&q=80', promoted: true },
  { id: 'f3', make: 'Toyota', model: 'Camry',    year: 2021, km: '38k км', price: 24500, priceDelta: 600, photo: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=500&auto=format&fit=crop&q=80' },
  { id: 'f4', make: 'Volvo', model: 'XC60',     year: 2020, km: '62k км', price: 32000, photo: 'https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=500&auto=format&fit=crop&q=80' },
  { id: 'f5', make: 'Lexus', model: 'RX',       year: 2022, km: '18k км', price: 48500, photo: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=500&auto=format&fit=crop&q=80' },
];

// Vertical feed — "keep scrolling" magazine cards below the shelves.
// Order is intentional: the promoted Big tile (d2) leads, then Small tiles below,
// with a second Big tile mid-list if promotedCount goes higher.
const E_FEED_CARS = [
  { id: 'd2', make: 'Porsche',     model: 'Macan',   year: 2022, km: '14 500 км', body: 'Кроссовер', price: 58900, priceDelta: 0,    match: 86, photo: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&auto=format&fit=crop&q=85', promoted: true },
  { id: 'd1', make: 'BMW',         model: 'X3',      year: 2021, km: '38 000 км', body: 'Кроссовер', price: 42000, priceDelta: 1200, match: 91, photo: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=900&auto=format&fit=crop&q=85' },
  { id: 'd3', make: 'Genesis',     model: 'G80',     year: 2021, km: '29 200 км', body: 'Седан',     price: 36400, priceDelta: 800,  match: 84, photo: 'https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=900&auto=format&fit=crop&q=85' },
  { id: 'd4', make: 'Tesla',       model: 'Model 3', year: 2021, km: '52 000 км', body: 'Седан',     price: 28900, priceDelta: 1600, match: 82, photo: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=900&auto=format&fit=crop&q=85' },
  { id: 'd5', make: 'Range Rover', model: 'Velar',   year: 2020, km: '46 800 км', body: 'Кроссовер', price: 44200, priceDelta: 0,    match: 78, photo: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=900&auto=format&fit=crop&q=85' },
  { id: 'd6', make: 'Mazda',       model: 'CX-9',    year: 2022, km: '21 400 км', body: 'Кроссовер', price: 33500, priceDelta: 0,    match: 76, photo: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=900&auto=format&fit=crop&q=85' },
];

const CarExEditorial = ({ t }) => {
  const [favs, setFavs] = React.useState({ d4: true });
  const toggleFav = (id) => setFavs(f => ({ ...f, [id]: !f[id] }));

  // Decide which IDs are promoted, capped by tweak count
  const allPromoted = ['hero-x5', 'f2', 'b2', 'b5'];
  const promotedActive = allPromoted.slice(0, t.promotedCount + 1); // hero always counted separately
  const heroPromoted = t.promotedCount >= 1;
  const promotedIds = promotedActive.filter(id => id !== 'hero-x5').slice(0, Math.max(0, t.promotedCount));

  const hero = { ...E_HERO_CARS[0], promoted: heroPromoted };

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      background: E.bg, color: E.text,
      fontFamily: E.font, letterSpacing: '-0.01em',
    }}>
      <div style={{ height: 54 }} />

      <FloatingSearch />
      <Greeting />

      <div style={{ marginTop: 8 }}>
        <HeroFeatured
          car={hero}
          promoted={hero.promoted}
          intensity={t.showFlameIcon ? t.promotedIntensity : Math.max(1, t.promotedIntensity)}
          showDisclosure={t.showDisclosure}
        />
      </div>

      <div style={{ marginTop: 22 }}>
        <SmartShelf
          kicker="Только что добавлено"
          title="Свежие предложения"
          cars={E_FRESH_CARS}
          promotedIds={promotedIds.includes('f2') ? ['f2'] : []}
          intensity={t.promotedIntensity}
          showDisclosure={t.showDisclosure}
          onFav={toggleFav}
          favs={favs}
        />
      </div>

      {/* Vertical feed — keep scrolling */}
      <div style={{ marginTop: 26, padding: '0 18px 12px' }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: E.blue,
          marginBottom: 5,
        }}>Ещё для вас</div>
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: '-0.028em',
          color: E.text, lineHeight: 1.05,
        }}>Больше предложений</div>
        <div style={{
          fontSize: 11.5, color: E.textMuted, marginTop: 4,
          fontFamily: E.fontMono, fontWeight: 600, letterSpacing: '-0.005em',
        }}>На основе вашей активности</div>
      </div>

      <div style={{
        padding: '0 18px',
        display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        {E_FEED_CARS.map((car, i) => {
          // Big tile = promoted (paid) content; Small tile = organic listing.
          // promotedCount controls how many feed cards get the big treatment.
          const isPromo = (t.promotedCount >= 1 && car.id === 'd2')
                      || (t.promotedCount >= 3 && car.id === 'd5');
          return isPromo ? (
            <BigFeedCard
              key={car.id}
              car={car}
              promoted={true}
              intensity={t.showFlameIcon ? t.promotedIntensity : Math.max(1, t.promotedIntensity)}
              showDisclosure={t.showDisclosure}
              faved={!!favs[car.id]}
              onFav={() => toggleFav(car.id)}
            />
          ) : (
            <SmallFeedCard
              key={car.id}
              car={car}
              faved={!!favs[car.id]}
              onFav={() => toggleFav(car.id)}
            />
          );
        })}
        <FeedLoader />
      </div>

      <div style={{ height: 32 }} />

      <EditorialDock />
    </div>
  );
};

Object.assign(window, { CarExEditorial, E });
