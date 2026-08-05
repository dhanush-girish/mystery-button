import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, Link } from 'react-router-dom';
import BigRedButton from '../components/BigRedButton';
import PlusOneVFX from '../components/PlusOneVFX';
import MuteToggle from '../components/MuteToggle';
import RankToast from '../components/RankToast';

const RANK_THRESHOLDS = [50, 25, 10];
const BATCH_INTERVAL_MS = 3000; // Sync score every 3s
const RANK_INTERVAL_MS = 10000; // Check rank every 10s

function GamePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // --- State ---
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [particles, setParticles] = useState([]);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Refs ---
  const pendingClicks = useRef(0);
  const particleId = useRef(0);
  const lastThreshold = useRef(Infinity);
  const mutedRef = useRef(false);

  // Keep muted ref in sync with state
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // --- Fetch player data on mount ---
  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/player', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!data.exists) {
          navigate('/setup', { replace: true });
          return;
        }

        setScore(data.player.score);
        setPlayerName(data.player.name);
      } catch (err) {
        console.error('Failed to fetch player:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayer();
  }, [getToken, navigate]);

  // --- Debounced batch score sync (every 3s) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      if (pendingClicks.current > 0) {
        const clicks = pendingClicks.current;
        pendingClicks.current = 0;

        try {
          const token = await getToken();
          const res = await fetch('/api/score', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ clicks }),
          });

          if (!res.ok) {
            // Re-add clicks if the request failed
            pendingClicks.current += clicks;
          }
        } catch (err) {
          // Re-add clicks on network failure
          pendingClicks.current += clicks;
          console.error('Failed to sync score:', err);
        }
      }
    }, BATCH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getToken]);

  // --- Periodic rank check (every 10s) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/rank', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (data.rank !== null) {
          // Find the player's current bracket
          let currentBracket = Infinity;
          for (const threshold of RANK_THRESHOLDS) {
            if (data.rank <= threshold) {
              currentBracket = threshold;
            }
          }

          // If this is the first time checking, just initialize silently
          if (lastThreshold.current === Infinity) {
            lastThreshold.current = currentBracket;
          } 
          // If they crossed into a better bracket, show toast
          else if (currentBracket < lastThreshold.current) {
            lastThreshold.current = currentBracket;
            setToast(
              `🔥 Keep clicking! You are in the Top ${currentBracket} on the leaderboard!`
            );
            // Auto-dismiss after 4 seconds
            setTimeout(() => setToast(null), 4000);
          }
        }
      } catch (err) {
        console.error('Failed to fetch rank:', err);
      }
    }, RANK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getToken]);

  // --- Flush pending clicks on page unload / component unmount ---
  useEffect(() => {
    const flush = async () => {
      if (pendingClicks.current > 0) {
        const clicks = pendingClicks.current;
        pendingClicks.current = 0;

        try {
          const token = await getToken();
          // Using fetch with keepalive for reliability during page close
          fetch('/api/score', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ clicks }),
            keepalive: true,
          });
        } catch (e) {
          // Best effort — if it fails, a few clicks are lost
        }
      }
    };

    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush(); // Also flush on React unmount
    };
  }, [getToken]);

  // --- Handle button press ---
  const handlePress = useCallback((x, y) => {
    // 1. Instantly update UI score
    setScore((prev) => prev + 1);
    pendingClicks.current += 1;

    // 2. Spawn +1 particle at click coordinates
    const id = particleId.current++;
    setParticles((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1000);

    // 3. Play sound effect (cloned audio for overlap)
    if (!mutedRef.current) {
      try {
        const audio = new Audio('/faaah.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Ignore autoplay policy errors
        });
      } catch (e) {
        // Audio not available
      }
    }
  }, []);

  // --- Render ---
  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="game-page">
      {/* Header: Mute + Leaderboard */}
      <div className="game-header">
        <MuteToggle muted={muted} onToggle={() => setMuted((prev) => !prev)} />
        <Link to="/leaderboard" className="leaderboard-link">
          🏆 LEADERBOARD
        </Link>
      </div>

      {/* Main Game Content */}
      <div className="game-content">
        <h1 className="game-title">THE MYSTERY BUTTON</h1>
        <p className="player-greeting">Go crazy, {playerName}!</p>

        <div className="score-display">
          <span className="score-label">SCORE</span>
          <span className="score-value">{score.toLocaleString()}</span>
        </div>

        <BigRedButton onPress={handlePress} />

        <div className="mystery-prize-text" style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#fff', 
          border: '4px solid #000', 
          boxShadow: '4px 4px 0 #000', 
          textAlign: 'center', 
          maxWidth: '400px', 
          margin: '20px auto', 
          fontFamily: "'Bangers', cursive",
          letterSpacing: '1px', 
          fontWeight: 'normal',
          transform: 'rotate(-2deg)'
        }}>
          Top 3 clickers on the final day of the event unlock the MYSTERY PRIZES! 🎁 What are they? Keep mashing to find out!
        </div>
      </div>

      {/* +1 Floating VFX */}
      <PlusOneVFX particles={particles} />

      {/* Rank Achievement Toast */}
      {toast && <RankToast message={toast} />}
    </div>
  );
}

export default GamePage;
