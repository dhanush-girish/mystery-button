import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
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

function SetupPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [batch, setBatch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Check if player already exists → redirect to game
  useEffect(() => {
    const checkPlayer = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/player', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.exists) {
          navigate('/game', { replace: true });
        }
      } catch (err) {
        console.error('Failed to check player:', err);
      } finally {
        setLoading(false);
      }
    };
    checkPlayer();
  }, [getToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name!');
      return;
    }
    if (!course) {
      setError('Please select your course!');
      return;
    }
    if (!batch) {
      setError('Please select your batch!');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = await getToken();
      const res = await fetch('/api/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          course,
          batch,
          profile_image_url: user?.imageUrl || null,
        }),
      });

      if (res.ok) {
        navigate('/game', { replace: true });
      } else {
        setError('Something went wrong. Try again!');
      }
    } catch (err) {
      console.error('Setup submit error:', err);
      setError('Network error. Please try again!');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <h1 className="setup-title">WHO ARE YOU?</h1>
        <p className="setup-subtitle">Tell us about yourself, brave clicker!</p>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="form-group">
            <label htmlFor="player-name">Your Name</label>
            <input
              id="player-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              maxLength={50}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label>Course</label>
            <SearchDropdown
              options={COURSES}
              value={course}
              onChange={setCourse}
              placeholder="Search your course..."
            />
          </div>

          <div className="form-group">
            <label>Batch</label>
            <SearchDropdown
              options={BATCHES}
              value={batch}
              onChange={setBatch}
              placeholder="Search your batch..."
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? 'SAVING...' : "LET'S GOOOO!"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default SetupPage;
