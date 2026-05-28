// CarEx — Search results screen for the Editorial design.
// Query: "Cadillac Escalade" · 25 results.

const ESCALADES = [
  { id: 'esc1',  year: 2021, km: '28 000 км',  trim: 'ESV Premium',     price: 62500, marketDelta: 2100, match: 96, photo: 'https://images.unsplash.com/photo-1606152421802-db97b9c7a11b?w=900&auto=format&fit=crop&q=85', promoted: true, posted: 'сегодня' },
  { id: 'esc2',  year: 2020, km: '42 000 км',  trim: 'Premium Luxury',  price: 54000, marketDelta: 800,  match: 91, photo: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=600&auto=format&fit=crop&q=80', posted: '2 ч назад' },
  { id: 'esc3',  year: 2022, km: '18 200 км',  trim: 'Sport Platinum',  price: 78900, marketDelta: 0,    match: 89, photo: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=600&auto=format&fit=crop&q=80', posted: '5 ч назад' },
  { id: 'esc4',  year: 2019, km: '67 000 км',  trim: 'Premium',         price: 41500, marketDelta: 1400, match: 87, photo: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&auto=format&fit=crop&q=80', promoted: true, posted: 'вчера' },
  { id: 'esc5',  year: 2021, km: '32 500 км',  trim: 'Luxury 4WD',      price: 58800, marketDelta: 400,  match: 85, photo: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&auto=format&fit=crop&q=80', posted: 'вчера' },
  { id: 'esc6',  year: 2018, km: '94 000 км',  trim: 'Platinum',        price: 36900, marketDelta: 600,  match: 82, photo: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600&auto=format&fit=crop&q=80', posted: '2 д назад' },
  { id: 'esc7',  year: 2023, km: '8 100 км',   trim: 'Sport',           price: 84200, marketDelta: 0,    match: 78, photo: 'https://images.unsplash.com/photo-1542362567-b07e54358753?w=600&auto=format&fit=crop&q=80', posted: '3 д назад' },
  { id: 'esc8',  year: 2017, km: '142 000 км', trim: 'Luxury',          price: 28500, marketDelta: 1900, match: 74, photo: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80', posted: '4 д назад' },
];

const SearchHeader = ({ saved, onToggleSave }) => (
  <div style={{
    position: 'sticky', top: 0, zIndex: 30,
    background: 'rgba(8,9,12,0.85)', backdropFilter: 'blur(18px)',
    borderBottom: `1px solid ${E.border}`,
    padding: '10px 16px 12px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <button style={{
        width: 38, height: 38, borderRadius: 12,
        background: E.surface, border: `1px solid ${E.border}`,
        color: E.text, display: 'grid', placeItems: 'center',
        cursor: 'pointer',
      }} aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 6-6 6 6 6"/>
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 19, fontWeight: 800, color: E.text,
          letterSpacing: '-0.025em', lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>Cadillac Escalade</div>
        <div style={{
          fontSize: 11.5, color: E.textMuted,
          fontFamily: E.fontMono, fontWeight: 600, marginTop: 2,
          letterSpacing: '-0.005em',
        }}>
          25 авто · Москва и регион
        </div>
      </div>
      <button onClick={onToggleSave} style={{
        width: 38, height: 38, borderRadius: 12,
        background: saved ? 'rgba(77,163,255,0.16)' : E.surface,
        border: `1px solid ${saved ? 'rgba(77,163,255,0.35)' : E.border}`,
        color: saved ? E.blue : E.text,
        display: 'grid', placeItems: 'center', cursor: 'pointer',
      }} aria-label="Сохранить поиск">
        <Icon name="bookmark" size={17} stroke={saved ? 2.4 : 2} />
      </button>
    </div>

    {/* Market context strip */}
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
      gap: 1,
      background: E.border,
      border: `1px solid ${E.border}`,
      borderRadius: 12, overflow: 'hidden',
      marginTop: 4,
    }}>
      <StatCell label="Ср. рынок" value="$58.4k" />
      <StatCell label="Год" value="'17—'24" />
      <StatCell label="Пробег" value="2—142k" />
    </div>
  </div>
);

const StatCell = ({ label, value }) => (
  <div style={{
    background: E.surface,
    padding: '8px 10px',
    textAlign: 'center',
  }}>
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
      textTransform: 'uppercase', color: E.textFaint,
      fontFamily: E.font, marginBottom: 3,
    }}>{label}</div>
    <div style={{
      fontSize: 13, fontWeight: 800, color: E.text,
      fontFamily: E.fontMono, letterSpacing: '-0.02em',
    }}>{value}</div>
  </div>
);

const ResultsFilterBar = () => {
  const [active, setActive] = React.useState({ year: true, body: true });
  const filters = [
    { id: 'year',  label: "Год '19+" },
    { id: 'price', label: 'До $80k' },
    { id: 'body',  label: 'SUV' },
    { id: 'trans', label: 'Автомат' },
    { id: 'fuel',  label: 'Бензин' },
  ];
  return (
    <div className="no-scrollbar" style={{
      display: 'flex', gap: 7, padding: '12px 16px 6px',
      overflowX: 'auto',
    }}>
      <button style={{
        flex: '0 0 auto',
        height: 32, padding: '0 11px 0 9px',
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: E.surface,
        border: `1px solid ${E.borderHi}`,
        borderRadius: 999,
        color: E.text,
        fontSize: 12.5, fontWeight: 700,
        fontFamily: E.font, letterSpacing: '-0.005em',
        cursor: 'pointer',
      }}>
        <Icon name="sliders" size={13} stroke={2.4}/>
        Фильтры
      </button>
      {filters.map(f => (
        <button key={f.id}
          onClick={() => setActive(s => ({ ...s, [f.id]: !s[f.id] }))}
          style={{
          flex: '0 0 auto',
          height: 32, padding: '0 12px',
          background: active[f.id] ? 'rgba(77,163,255,0.14)' : E.surface,
          border: `1px solid ${active[f.id] ? 'rgba(77,163,255,0.35)' : E.border}`,
          borderRadius: 999,
          color: active[f.id] ? E.blue : E.text,
          fontSize: 12.5, fontWeight: 700,
          fontFamily: E.font, letterSpacing: '-0.005em',
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          {active[f.id] && (
            <span style={{ marginRight: 4 }}>✓</span>
          )}
          {f.label}
        </button>
      ))}
    </div>
  );
};

const SortRow = () => (
  <div style={{
    padding: '10px 16px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }}>
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: E.textFaint,
    }}>
      Все результаты
    </div>
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'transparent', border: 'none',
      color: E.text, fontSize: 12.5, fontWeight: 700,
      fontFamily: E.font, cursor: 'pointer',
      padding: '4px 0',
    }}>
      По релевантности
      <Icon name="chevron-down" size={14} stroke={2.2}/>
    </button>
  </div>
);

// Hero result card — "Best match"
const HeroResult = ({ car, promoted, intensity, showDisclosure, faved, onFav }) => {
  const glowAlpha = [0, 0.16, 0.30, 0.45][intensity] || 0.30;
  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: E.blue,
        marginBottom: 8,
      }}>
        ⭐ Лучшее совпадение
      </div>
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

            {/* Match score top-left */}
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

            {/* Favorite top-right */}
            <button onClick={onFav} style={{
              position: 'absolute', top: 12, right: 12,
              width: 36, height: 36, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'rgba(8,9,12,0.55)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: faved ? '#ff5d7a' : '#fff',
              cursor: 'pointer',
            }}>
              <Icon name={faved ? 'heart-fill' : 'heart'} size={16} />
            </button>

            {/* Promoted micro-icon */}
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

            {/* Info overlay */}
            <div style={{
              position: 'absolute', left: 16, right: 16, bottom: 16,
              color: E.text,
            }}>
              <div style={{
                fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em',
                lineHeight: 1.05,
              }}>
                Cadillac Escalade
              </div>
              <div style={{
                fontSize: 12, color: E.textMuted, marginTop: 3,
                fontFamily: E.fontMono, fontWeight: 600,
                letterSpacing: '-0.005em',
              }}>
                {car.year} · {car.km} · {car.trim}
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
                  {car.marketDelta > 0 && (
                    <div style={{
                      marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 999,
                      background: 'rgba(103,232,182,0.14)',
                      border: '1px solid rgba(103,232,182,0.3)',
                      color: E.green, fontSize: 10.5, fontWeight: 700,
                      fontFamily: E.fontMono, letterSpacing: '-0.005em',
                      whiteSpace: 'nowrap',
                    }}>
                      ↓ ниже рынка на ${car.marketDelta.toLocaleString('en-US')}
                    </div>
                  )}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '8px 12px', borderRadius: 12,
                  background: E.text, color: '#08090C',
                  fontSize: 12.5, fontWeight: 800,
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
    </div>
  );
};

// Horizontal result card — used in the list
const ResultCard = ({ car, promoted, intensity, showDisclosure, faved, onFav }) => {
  const glowAlpha = [0, 0.16, 0.28, 0.42][intensity] || 0.28;
  return (
    <div style={{
      position: 'relative',
      filter: promoted && intensity > 0 ? `drop-shadow(0 6px 18px rgba(255,209,102,${glowAlpha}))` : 'none',
    }}>
      <div style={{
        padding: promoted && intensity > 0 ? 1.5 : 0,
        borderRadius: 18,
        background: promoted && intensity > 0
          ? `linear-gradient(155deg, rgba(255,209,102,${0.50 * (intensity/2 || 1)}) 0%, rgba(77,163,255,${0.28 * (intensity/2 || 1)}) 100%)`
          : 'transparent',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '130px 1fr',
          gap: 0,
          background: promoted ? E.surfaceHi : E.surface,
          borderRadius: 16.5,
          overflow: 'hidden',
          border: promoted ? 'none' : `1px solid ${E.border}`,
          cursor: 'pointer',
        }}>
          {/* Photo */}
          <div style={{ position: 'relative', aspectRatio: '1/1', background: '#1a1e28' }}>
            <img src={car.photo} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: promoted ? 'saturate(1.18) contrast(1.04) brightness(1.03)' : 'none',
            }}/>
            {/* match score */}
            {!promoted && (
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
            )}
            {/* promoted flame */}
            {promoted && intensity > 0 && (
              <div style={{
                position: 'absolute', top: 7, left: 7,
                width: 22, height: 22, borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                background: 'linear-gradient(155deg, rgba(255,209,102,0.95), rgba(255,160,80,0.85))',
                color: '#1a1308',
                boxShadow: '0 0 10px rgba(255,209,102,0.5)',
                animation: 'shimmer 2.6s ease-in-out infinite',
              }}>
                <Icon name="flame" size={11} stroke={2.3}/>
              </div>
            )}
            {promoted && showDisclosure && (
              <div style={{
                position: 'absolute', bottom: 5, left: 6,
                fontSize: 7.5, color: 'rgba(255,255,255,0.55)',
                fontFamily: E.fontMono, letterSpacing: '0.10em',
                textTransform: 'uppercase', fontWeight: 600,
                background: 'rgba(8,9,12,0.4)', backdropFilter: 'blur(4px)',
                padding: '1px 5px', borderRadius: 4,
              }}>реклама</div>
            )}
          </div>

          {/* Info */}
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
                }}>
                  Cadillac Escalade
                </div>
                <div style={{
                  fontSize: 11, color: E.textMuted, marginTop: 2,
                  fontFamily: E.fontMono, fontWeight: 600,
                  letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {car.year} · {car.trim}
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

            {/* meta row */}
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
              <span style={{ color: E.textFaint }}>·</span>
              <span>{car.posted}</span>
            </div>

            {/* price row */}
            <div style={{
              marginTop: 10,
              display: 'flex', alignItems: 'baseline',
              justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{
                fontSize: 17, fontWeight: 800,
                color: promoted ? E.gold : E.text,
                fontFamily: E.fontMono, letterSpacing: '-0.02em',
              }}>
                ${car.price.toLocaleString('en-US')}
              </div>
              {car.marketDelta > 0 && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 10, fontWeight: 700, color: E.green,
                  fontFamily: E.fontMono, letterSpacing: '-0.005em',
                  whiteSpace: 'nowrap',
                }}>
                  ↓ ${car.marketDelta.toLocaleString('en-US')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CarExSearchResults = ({ t }) => {
  const [savedSearch, setSavedSearch] = React.useState(true);
  const [favs, setFavs] = React.useState({ esc2: true });
  const toggleFav = (id) => setFavs(f => ({ ...f, [id]: !f[id] }));

  // Honor the promoted count tweak: hero counts as 1, plus up to 1 more in the list (#4 position).
  const heroPromoted = t.promotedCount >= 1 ? ESCALADES[0].promoted : false;
  const listPromotedIds = t.promotedCount >= 2 ? new Set(['esc4']) : new Set();

  const heroCar = ESCALADES[0];
  const restCars = ESCALADES.slice(1);

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      background: E.bg, color: E.text,
      fontFamily: E.font, letterSpacing: '-0.01em',
    }}>
      <div style={{ height: 54 }} />

      <SearchHeader saved={savedSearch} onToggleSave={() => setSavedSearch(s => !s)} />
      <ResultsFilterBar />

      <div style={{ height: 12 }} />

      <HeroResult
        car={heroCar}
        promoted={heroPromoted}
        intensity={t.showFlameIcon ? t.promotedIntensity : Math.max(1, t.promotedIntensity)}
        showDisclosure={t.showDisclosure}
        faved={!!favs[heroCar.id]}
        onFav={() => toggleFav(heroCar.id)}
      />

      <SortRow />

      <div style={{
        padding: '0 16px',
        display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        {restCars.map(c => (
          <ResultCard
            key={c.id}
            car={c}
            promoted={listPromotedIds.has(c.id)}
            intensity={t.showFlameIcon ? t.promotedIntensity : Math.max(1, t.promotedIntensity)}
            showDisclosure={t.showDisclosure}
            faved={!!favs[c.id]}
            onFav={() => toggleFav(c.id)}
          />
        ))}
        {/* fake load-more affordance */}
        <button style={{
          marginTop: 8, marginBottom: 4,
          padding: '14px 0',
          background: 'transparent',
          border: `1px dashed ${E.borderHi}`,
          borderRadius: 14,
          color: E.text,
          fontSize: 13, fontWeight: 700,
          fontFamily: E.font, letterSpacing: '-0.005em',
          cursor: 'pointer',
        }}>
          Показать ещё 17 объявлений
        </button>
      </div>

      <div style={{ height: 28 }} />

      <EditorialDock />
    </div>
  );
};

Object.assign(window, { CarExSearchResults });
