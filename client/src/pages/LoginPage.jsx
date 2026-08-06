import { useAuth, useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const clerk = useClerk();
  const navigate = useNavigate();

  // If already signed in, redirect to setup/game
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/setup', { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate]);

  const handleEnter = () => {
    clerk.openSignIn({
      // This opens the Clerk sign-in modal with Google OAuth
      redirectUrl: '/setup',
    });
  };

  if (!isLoaded) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">THE MYSTERY BUTTON</h1>
        <p className="login-subtitle">Do you dare to click?</p>
        <button className="enter-button" onClick={handleEnter}>
          JOIN THE BATTLE
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
