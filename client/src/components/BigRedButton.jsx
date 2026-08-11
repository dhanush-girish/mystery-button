function BigRedButton({ onPress, disabled = false }) {
  const handlePointerDown = (e) => {
    // Prevent default to avoid double-firing and text selection
    e.preventDefault();
    if (disabled) return;

    // Get click/touch coordinates for VFX positioning
    const x = e.clientX;
    const y = e.clientY;
    onPress(x, y);
  };

  return (
    <button
      className={`big-red-button${disabled ? ' big-red-button-disabled' : ''}`}
      onPointerDown={handlePointerDown}
      disabled={disabled}
      aria-label="Click the mystery button!"
    >
      <span className="button-glare"></span>
      <span className="button-text">{disabled ? '🔒 LOCKED' : 'CLICK ME!'}</span>
    </button>
  );
}

export default BigRedButton;
