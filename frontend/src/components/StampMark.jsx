export default function StampMark() {
  return (
    <span
      style={{
        display: 'inline-block',
        border: '2px solid var(--accent)',
        color: 'var(--accent)',
        borderRadius: '50%',
        width: 28,
        height: 28,
        textAlign: 'center',
        lineHeight: '24px',
        fontFamily: 'var(--font-title)',
        fontWeight: 700,
      }}
    >
      印
    </span>
  );
}
