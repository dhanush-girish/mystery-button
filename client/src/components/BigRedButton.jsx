function BigRedButton({ onPress }) {
  const handlePointerDown = (e) => {
    // Prevent default to avoid double-firing and text selection
    e.preventDefault();

    // Get click/touch coordinates for VFX positioning
    const x = e.clientX;
    const y = e.clientY;
    onPress(x, y);
  };

  return (
    <button
      className="big-red-button"
      onPointerDown={handlePointerDown}
      aria-label="Click the mystery button!"
    >
      <span className="button-glare"></span>
      <span className="button-text">CLICK ME!</span>
    </button>
  );
}

export default BigRedButton;
