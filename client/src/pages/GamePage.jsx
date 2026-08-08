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

const MILESTONES = {
  1000: { image: '1000.jpeg', caption: 'Choodu chaya for the choodu fingers. Keep clicking👍' },
  2500: { image: '2500.jpeg', caption: 'Aliya, thalaruthu! 🥵, Grab this juice👍' },
  5000: { image: '5000.jpeg', caption: 'System Hang Aayi! 🚨 You literally need wings to mash any faster' },
  10000: { image: '10000.jpeg', caption: 'Nee puliyada puli! 🐅 Ultimate hydration level unlocked. Drink the Karikku and survive.' },
};

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
  const [currentRank, setCurrentRank] = useState(null);
  const [selectedSfx, setSelectedSfx] = useState('faaah');
  const [milestonePopup, setMilestonePopup] = useState(null);

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
          setCurrentRank(data.rank);
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
    setScore((prev) => {
      const newScore = prev + 1;
      
      // Check for milestones
      if (newScore === 1000 || newScore === 2500 || newScore === 5000 || newScore === 10000) {
        setMilestonePopup(newScore);
      }
      
      return newScore;
    });
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
        const audio = new Audio(`/${selectedSfx}.mp3`);
        audio.volume = 0.5;
        audio.play().catch(() => {
          // Ignore autoplay policy errors
        });
      } catch (e) {
        // Audio not available
      }
    }
  }, [selectedSfx]);

  // --- Render ---
  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="game-page">
      {/* Header: Mute + SFX + Leaderboard */}
      <div className="game-header">
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <MuteToggle muted={muted} onToggle={() => setMuted((prev) => !prev)} />
          <select 
            value={selectedSfx} 
            onChange={(e) => setSelectedSfx(e.target.value)}
            style={{
              fontFamily: "'Bangers', cursive",
              fontSize: '1.2rem',
              padding: '4px 8px',
              border: '3px solid #111',
              boxShadow: '3px 3px 0 #111',
              cursor: 'pointer'
            }}
          >
            <option value="faaah">faaah.mp3</option>
            <option value="faaah-2">faaah-2.mp3</option>
            <option value="mario-jump">mario-jump.mp3</option>
            <option value="suuuuuuuuuuuuu">suuuuuuuuuuuuu.mp3</option>
          </select>
        </div>
        <Link to="/leaderboard" className="leaderboard-link">
          🏆 LEADERBOARD
        </Link>
      </div>

      {/* Main Game Content */}
      <div className="game-content">
        <h1 className="game-title">THE MYSTERY BUTTON</h1>
        <p className="player-greeting">Go crazy, {playerName}!</p>

        <div className="score-display">
          {currentRank && (
            <span style={{ fontSize: '1.2rem', color: '#555', marginBottom: '-5px' }}>
              RANK: #{currentRank}
            </span>
          )}
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

      {/* Milestone Popup */}
      {milestonePopup && MILESTONES[milestonePopup] && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fff', border: '5px solid #111', boxShadow: '8px 8px 0 #111',
            padding: '25px', textAlign: 'center', maxWidth: '400px', width: '90%', transform: 'rotate(-1deg)',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: '2.8rem', color: '#ff1493', textShadow: '2px 2px 0 #111', margin: '0 0 15px 0', letterSpacing: '2px' }}>
              MILESTONE UNLOCKED!
            </h2>
            <img 
              src={`/${MILESTONES[milestonePopup].image}`} 
              alt={`Milestone ${milestonePopup}`} 
              style={{ width: '100%', border: '4px solid #111', marginBottom: '20px', borderRadius: '4px' }}
              onError={(e) => {
                e.target.style.display = 'none'; // hide if placeholder image not found
              }}
            />
            <p style={{ fontFamily: "'Bangers', cursive", fontSize: '1.6rem', color: '#333', marginBottom: '25px', lineHeight: '1.2', letterSpacing: '1px' }}>
              {MILESTONES[milestonePopup].caption}
            </p>
            <button 
              onClick={() => setMilestonePopup(null)}
              style={{
                fontFamily: "'Bangers', cursive", fontSize: '1.8rem', padding: '12px 25px',
                backgroundColor: '#00cfff', color: '#fff', border: '4px solid #111', boxShadow: '5px 5px 0 #111',
                cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s', letterSpacing: '2px'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(4px)';
                e.currentTarget.style.boxShadow = '1px 1px 0 #111';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '5px 5px 0 #111';
              }}
            >
              THANKS ANNA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GamePage;
