import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';

// ═══════════════════════════════════════════════════════════════
// CaptchaChallenge — Gamified shape-click CAPTCHA
//
// Shows a target shape among 2–3 decoys. User has 5 seconds.
// On failure: server gives 1 retry, then shadowbans silently.
// Stray clicks on the overlay (not on shapes) count as failure.
// ═══════════════════════════════════════════════════════════════

const SHAPE_COLORS = {
  circle: '#FF6B6B',
  star: '#FFD93D',
  triangle: '#6BCB77',
  square: '#4D96FF',
  diamond: '#9B59B6',
};

const SHAPE_LABELS = {
  circle: '⭕ CIRCLE',
  star: '⭐ STAR',
  triangle: '🔺 TRIANGLE',
  square: '🟦 SQUARE',
  diamond: '💎 DIAMOND',
};

/** Renders a shape using CSS clip-paths / border-radius. */
function ShapeIcon({ type, size = 55 }) {
  const color = SHAPE_COLORS[type] || '#999';

  const styleMap = {
    circle: {
      width: size, height: size, borderRadius: '50%',
      backgroundColor: color, border: '3px solid #111',
    },
    star: {
      width: size, height: size, backgroundColor: color,
      clipPath:
        'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
    },
    triangle: {
      width: size, height: size, backgroundColor: color,
      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
    },
    square: {
      width: size * 0.85, height: size * 0.85,
      backgroundColor: color, border: '3px solid #111',
    },
    diamond: {
      width: size * 0.7, height: size * 0.7,
      backgroundColor: color, border: '3px solid #111',
      transform: 'rotate(45deg)',
    },
  };

  return <div style={styleMap[type] || {}} />;
}

function CaptchaChallenge({ captchaData, onDismiss }) {
  const { getToken } = useAuth();
  const [captcha, setCaptcha] = useState(captchaData);
  const [timeLeft, setTimeLeft] = useState(
    Math.ceil((captchaData.timeout_ms || 5000) / 1000)
  );
  const [retryMsg, setRetryMsg] = useState('');

  // Refs for mutable state accessed in async/timer callbacks
  const lockedRef = useRef(false);
  const strayRef = useRef(0);
  const timerRef = useRef(null);
  const submitRef = useRef(null);

  // ── Submit function (kept in ref to avoid stale closures) ──
  submitRef.current = async (selectedType, timedOut) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const token = await getToken();
      const res = await fetch('/api/verify-captcha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          captcha_id: captcha.captcha_id,
          selected_shape_type: selectedType || null,
          timed_out: !!timedOut,
          stray_clicks: strayRef.current,
        }),
      });
      const data = await res.json();

      if (data.retry && data.captcha) {
        // First failure → retry with new captcha
        setRetryMsg('❌ Wrong! Try again…');
        setCaptcha(data.captcha);
        strayRef.current = 0;
        lockedRef.current = false;
        // Timer restarts via useEffect dependency on captcha_id
      } else {
        // Success or silent shadowban → dismiss
        onDismiss();
      }
    } catch {
      // Network error → dismiss to avoid softlock
      onDismiss();
    }
  };

  // ── Countdown timer — restarts when captcha changes ──
  useEffect(() => {
    lockedRef.current = false;
    const duration = captcha.timeout_ms || 5000;
    const start = Date.now();
    setTimeLeft(Math.ceil(duration / 1000));

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(
        0,
        Math.ceil((duration - elapsed) / 1000)
      );
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        submitRef.current(null, true); // Timeout
      }
    }, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [captcha.captcha_id]);

  // ── Stray click tracking ──
  const handleArenaClick = (e) => {
    // Only count clicks that land on the arena background, not on shapes
    if (!e.target.closest('.captcha-shape-btn')) {
      strayRef.current++;
    }
  };

  const targetName =
    SHAPE_LABELS[captcha.target_shape] ||
    captcha.target_shape.toUpperCase();
  const maxTime = Math.ceil((captcha.timeout_ms || 5000) / 1000);

  return (
    <div className="captcha-overlay">
      <div className="captcha-container">
        <h2 className="captcha-title">🎯 QUICK CHALLENGE!</h2>

        {retryMsg && <p className="captcha-retry-msg">{retryMsg}</p>}

        <p className="captcha-instruction">
          Tap the{' '}
          <span
            style={{
              color: SHAPE_COLORS[captcha.target_shape],
              fontWeight: 'bold',
            }}
          >
            {targetName}
          </span>
        </p>

        {/* Timer bar */}
        <div className="captcha-timer-bar">
          <div
            className="captcha-timer-fill"
            style={{
              width: `${(timeLeft / maxTime) * 100}%`,
              backgroundColor: timeLeft <= 2 ? '#ff4444' : '#00cfff',
              transition: 'width 0.2s linear',
            }}
          />
        </div>
        <span className="captcha-timer-text">{timeLeft}s</span>

        {/* Shape arena */}
        <div
          className="captcha-arena"
          onPointerDown={handleArenaClick}
        >
          {captcha.shapes.map((shape) => (
            <button
              key={shape.id}
              className="captcha-shape-btn"
              style={{
                left: `${shape.x}%`,
                top: `${shape.y}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                submitRef.current(shape.type, false);
              }}
              disabled={lockedRef.current}
              aria-label={`Shape ${shape.id}`}
            >
              <ShapeIcon type={shape.type} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CaptchaChallenge;
