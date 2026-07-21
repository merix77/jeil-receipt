import { useEffect, useRef, useState } from 'react';

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      })
      .catch((err) => setError(err.message));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleShutter() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      },
      'image/jpeg',
      0.92
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {error ? (
        <p style={{ color: '#fff', padding: 16 }}>카메라를 열 수 없습니다: {error}</p>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ flex: 1, width: '100%', objectFit: 'contain' }}
        />
      )}

      <div style={{ display: 'flex', gap: 12, padding: 16 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 14, fontSize: 16 }}>
          취소
        </button>
        {!error && (
          <button
            onClick={handleShutter}
            style={{
              flex: 2,
              padding: 14,
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
            }}
          >
            촬영
          </button>
        )}
      </div>
    </div>
  );
}
