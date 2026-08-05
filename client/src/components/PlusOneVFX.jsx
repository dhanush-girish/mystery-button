function PlusOneVFX({ particles }) {
  return (
    <div className="vfx-container" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="plus-one"
          style={{ left: p.x, top: p.y }}
        >
          +1
        </div>
      ))}
    </div>
  );
}

export default PlusOneVFX;
