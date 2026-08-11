import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import SearchDropdown from '../components/SearchDropdown';
import EventTimer from '../components/EventTimer';

const COURSES = [
  'MSc in Computer Science (Artificial Intelligence)',
  'MSc in Computer Science (Cyber Security)',
  'MSc Advanced Artificial Intelligence (1 Year)',
  'MSc Cyber Security (1 Year)',
  'MSc in Computer Science (Data Analytics)',
  'MSc in Data Science and Bio AI',
  'MSc in Data Science and Fintech',
  'MSc in Data Science and Geoinformatics',
  'MSc in Data Science and Computational Modelling',
  'MSc in Data Science and Product Development',
  'MSc in Electronics (AI and VLSI)',
  'MSc in Electronics (VLSI and Embedded Systems)',
  'MSc in Applied Physics (AI and Advanced Materials)',
  'MSc in Applied Physics (Applied Materials)',
  'MSc in Ecology',
  'MSc in Environmental Sustainability (1 Year)',
  'MSc in Environmental Science',
  'MTECH in Computer Science and Engineering (Artificial Intelligence)',
  'MTECH in Computer Science and Engineering (Cyber Security Engineering)',
  'MTECH in Electronics Engineering (AI Hardware)',
  'MTECH in Electronics Engineering (VLSI Design)',
  'Master of Business Administration (MBA)',
  'Master of Business Administration for Working Professionals (MBA - WP)',
  'Master of Business Administration in Supply Chain Management and Logistics (MBA SCM and Logistics)',
];

const BATCHES = [
  '2025-2027',
  '2026-2028',
  '2026-2027(one year courses)'
];

const MEDALS = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

function LeaderboardPage() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [players, setPlayers] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [eventEnded, setEventEnded] = useState(false);

  useEffect(() => {
    if (!isLoaded) return; // wait until auth state is known

    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (courseFilter) params.set('course', courseFilter);
        if (batchFilter) params.set('batch', batchFilter);

        // Send auth token if signed in (enables leaderboard ghosting)
        const headers = {};
        if (isSignedIn) {
          try {
            const token = await getToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          } catch {
            // Continue without auth
          }
        }

        const res = await fetch(`/api/leaderboard?${params.toString()}`, { headers });
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [courseFilter, batchFilter, isLoaded, isSignedIn, getToken]);

  const clearFilters = () => {
    setCourseFilter('');
    setBatchFilter('');
  };

  const handleEventEnd = useCallback(() => {
    setEventEnded(true);
  }, []);

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-card">
        {/* Event Timer */}
        <EventTimer onEventEnd={handleEventEnd} />

        {/* Header */}
        <div className="leaderboard-header">
          <Link to="/game" className="back-link">
            ← BACK TO GAME
          </Link>
          <h1 className="leaderboard-title">
            🏆 {eventEnded ? 'FINAL ' : ''}LEADERBOARD
          </h1>
        </div>

        {/* Filters */}
        <div className="leaderboard-filters">
          <div className="filter-group">
            <label>Filter by Course</label>
            <SearchDropdown
              options={COURSES}
              value={courseFilter}
              onChange={setCourseFilter}
              placeholder="All Courses"
            />
            {courseFilter && (
              <button className="filter-clear-btn" onClick={() => setCourseFilter('')}>
                ✕ Clear
              </button>
            )}
          </div>
          <div className="filter-group">
            <label>Filter by Batch</label>
            <SearchDropdown
              options={BATCHES}
              value={batchFilter}
              onChange={setBatchFilter}
              placeholder="All Batches"
            />
            {batchFilter && (
              <button className="filter-clear-btn" onClick={() => setBatchFilter('')}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {(courseFilter || batchFilter) && (
          <button
            className="filter-clear-btn"
            onClick={clearFilters}
            style={{ marginBottom: 15, fontSize: '1.1rem' }}
          >
            ✕ Clear All Filters
          </button>
        )}

        {/* Table for ALL players */}
        {loading ? (
          <div className="loading" style={{ minHeight: 200 }}>
            Loading...
          </div>
        ) : (
          <div className="leaderboard-table-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Course</th>
                  <th>Batch</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => {
                  const rank = idx + 1;
                  const medal = MEDALS[rank];
                  const isTop3 = rank <= 3;
                  return (
                    <tr key={rank} className={isTop3 ? `top-rank top-rank-${rank}` : ''}>
                      <td className="rank-cell">
                        {medal ? (
                          <span className="medal-rank">
                            <span className="medal-emoji">{medal}</span>
                          </span>
                        ) : rank}
                      </td>
                      <td className={isTop3 ? 'top-rank-name' : ''}>{player.name}</td>
                      <td className="course-cell">
                        <div className="course-marquee">
                          <span>{player.course}</span>
                        </div>
                      </td>
                      <td>{player.batch}</td>
                      <td className="score-cell">
                        {Number(player.score).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">
                      No players found. Be the first to play!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardPage;
