import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * TopProgressBar — high-tech, razor-thin navigation progress indicator
 * at the top of the viewport during route transitions.
 */
export function TopProgressBar() {
  const location = useLocation();
  const [animating, setAnimating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start animation on route change
    setAnimating(true);
    setProgress(35);

    const step1 = setTimeout(() => {
      setProgress(80);
    }, 80);

    const step2 = setTimeout(() => {
      setProgress(100);
    }, 220);

    const step3 = setTimeout(() => {
      setAnimating(false);
      setProgress(0);
    }, 450);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
    };
  }, [location.pathname, location.search]);

  // Disable on clinic/workstation routes to avoid dual-layer loading with contextual Skeletons
  const isWorkstation =
    location.pathname.startsWith('/clinic') ||
    location.pathname.includes('/check-in') ||
    location.pathname.includes('/screening') ||
    location.pathname.includes('/blood-bags');

  if (isWorkstation || (!animating && progress === 0)) {
    return null;
  }

  return (
    <div
      className="top-progress-bar"
      role="progressbar"
      aria-label="Đang tải trang"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="top-progress-bar__indicator"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'width 0.15s ease-out, opacity 0.25s ease' : 'width 0.25s ease-out',
        }}
      />
    </div>
  );
}
