import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// Same cutoff as server — hardcoded UTC timestamp.
// August 14, 2026, 16:00:00 IST = 10:30:00 UTC
// ═══════════════════════════════════════════════════════════════
const EVENT_CUTOFF_MS = new Date('2026-08-14T10:30:00.000Z').getTime();

function EventTimer({ onEventEnd }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = EVENT_CUTOFF_MS - Date.now();
      if (diff <= 0) {
        setEnded(true);
        onEventEnd?.();
        return true;
      }
      setTimeLeft({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      });
      return false;
    };

    if (update()) return; // Already ended on mount
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [onEventEnd]);

  // ── Event Ended: full-screen overlay ──
  if (ended) {
    return (
      <div className="event-ended-overlay">
        <div className="event-ended-card">
          <h1 className="event-ended-title">🏁 THE EVENT HAS ENDED!</h1>
          <p className="event-ended-subtitle">Thanks for clicking! 🎉</p>
          <p className="event-ended-text">
            Check the leaderboard to see the final results.
          </p>
          <Link to="/leaderboard" className="event-ended-link">
            🏆 VIEW FINAL LEADERBOARD
          </Link>
        </div>
      </div>
    );
  }

  if (!timeLeft) return null;

  // ── Countdown timer bar ──
  return (
    <div className="event-timer">
      <span className="event-timer-label">⏰ EVENT ENDS IN</span>
      <div className="event-timer-digits">
        <div className="timer-segment">
          <span className="timer-value">{timeLeft.days}</span>
          <span className="timer-unit">D</span>
        </div>
        <span className="timer-separator">:</span>
        <div className="timer-segment">
          <span className="timer-value">
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span className="timer-unit">H</span>
        </div>
        <span className="timer-separator">:</span>
        <div className="timer-segment">
          <span className="timer-value">
            {String(timeLeft.minutes).padStart(2, '0')}
          </span>
          <span className="timer-unit">M</span>
        </div>
        <span className="timer-separator">:</span>
        <div className="timer-segment">
          <span className="timer-value">
            {String(timeLeft.seconds).padStart(2, '0')}
          </span>
          <span className="timer-unit">S</span>
        </div>
      </div>
    </div>
  );
}

export default EventTimer;
