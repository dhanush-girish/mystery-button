import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SearchDropdown from '../components/SearchDropdown';

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

function LeaderboardPage() {
  const [players, setPlayers] = useState([]);
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch leaderboard data whenever filters change
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (courseFilter) params.set('course', courseFilter);
        if (batchFilter) params.set('batch', batchFilter);

        const res = await fetch(`/api/leaderboard?${params.toString()}`);
        const data = await res.json();
        setPlayers(data);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [courseFilter, batchFilter]);

  const clearFilters = () => {
    setCourseFilter('');
    setBatchFilter('');
  };

  const top3 = players.slice(0, 3);
  const restPlayers = players.slice(3);

  // Helper to get ordered players for podium (Rank 2, Rank 1, Rank 3)
  const podiumPlayers = [];
  if (top3[1]) podiumPlayers.push({ ...top3[1], podiumRank: 2 });
  if (top3[0]) podiumPlayers.push({ ...top3[0], podiumRank: 1 });
  if (top3[2]) podiumPlayers.push({ ...top3[2], podiumRank: 3 });

  // Sort by podium placement order: 2, 1, 3
  podiumPlayers.sort((a, b) => {
    const order = { 2: 1, 1: 2, 3: 3 };
    return order[a.podiumRank] - order[b.podiumRank];
  });

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-card">
        {/* Header */}
        <div className="leaderboard-header">
          <Link to="/game" className="back-link">
            ← BACK TO GAME
          </Link>
          <h1 className="leaderboard-title">🏆 LEADERBOARD</h1>
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

        {/* Podium for Top 3 */}
        {!loading && podiumPlayers.length > 0 && (
          <div className="podium-container">
            {podiumPlayers.map((player) => (
              <div key={player.podiumRank} className={`podium-place rank-${player.podiumRank}`}>
                <div className="stickman">
                  <div className="stickman-head">
                    {player.profile_image_url ? (
                      <img src={player.profile_image_url} alt={player.name} />
                    ) : (
                      <span className="placeholder">?</span>
                    )}
                  </div>
                  <div className="stickman-body">
                    <div className="stickman-arms"></div>
                    <div className="stickman-legs">
                      <div className="stickman-leg left"></div>
                      <div className="stickman-leg right"></div>
                    </div>
                  </div>
                </div>
                <div className="podium-block">
                  <div className="podium-rank-number">{player.podiumRank}</div>
                  <div className="podium-name">{player.name}</div>
                  <div className="podium-course" style={{ fontSize: '0.9rem', color: '#555', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {player.course}
                  </div>
                  <div className="podium-batch" style={{ fontSize: '0.8rem', color: '#777', marginTop: '2px' }}>
                    {player.batch}
                  </div>
                  <div className="podium-score-val" style={{ fontSize: '1.4rem', color: '#ff1493', marginTop: '5px' }}>
                    {Number(player.score).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table for remaining players */}
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
                {restPlayers.map((player, idx) => {
                  const actualRank = idx + 4; // since top 3 are in podium
                  return (
                    <tr key={actualRank}>
                      <td className="rank-cell">{actualRank}</td>
                      <td>{player.name}</td>
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
