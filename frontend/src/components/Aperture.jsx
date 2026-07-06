import React, { useState, useEffect } from 'react';

export default function Aperture({
  active = true,
  strainScore = 0,
  blinkTrigger = false,
  size = 200
}) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Monitor prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Shutter flutter on blink trigger
  useEffect(() => {
    if (blinkTrigger) {
      setIsBlinking(true);
      const timer = setTimeout(() => {
        setIsBlinking(false);
      }, 120); // 120ms quick flutter
      return () => clearTimeout(timer);
    }
  }, [blinkTrigger]);

  // Interpolate color based on strain score
  const getBladeColor = () => {
    if (strainScore > 75) return '#ff6b5e'; // alert-coral
    if (strainScore > 35) return '#e8a33d'; // iris-amber
    return '#4fd8c4'; // tear-film
  };

  const bladeColor = getBladeColor();

  // Draw 8 blades at 45 degree rotations
  const blades = Array.from({ length: 8 });

  // Map strain score (0 to 100) to closure angle (0 to 30 degrees rotation)
  // Low strain (0) -> wide open (0deg extra rotation)
  // High strain (100) -> closed (30deg extra rotation)
  const closureRotation = (strainScore / 100) * 26;
  const blinkRotation = isBlinking ? 40 : 0;
  
  // Calculate dynamic rotation for each blade
  const getBladeTransform = (index) => {
    if (reducedMotion) {
      // In reduced motion, just render static angle
      const finalRot = index * 45 + closureRotation;
      return `rotate(${finalRot} 100 100)`;
    }

    const baseRotation = index * 45;
    const finalRot = baseRotation + closureRotation + blinkRotation;
    return `rotate(${finalRot} 100 100)`;
  };

  return (
    <div
      className={`relative flex items-center justify-center`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        className={`select-none ${active && !reducedMotion && !isBlinking ? 'animate-breath' : ''}`}
        style={{
          transformOrigin: 'center',
          transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Outer casing ring of the lens */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="#181c25"
          strokeWidth="6"
        />
        <circle
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke={bladeColor}
          strokeWidth="1.5"
          opacity="0.25"
          style={{ transition: 'stroke 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />

        {/* Aperture blades group */}
        <g id="aperture-blades">
          {blades.map((_, i) => (
            <path
              key={i}
              // Standard overlapping camera blade vector
              d="M 100,12 C 120,12 154,24 168,52 L 118,82 C 110,64 100,56 100,56 Z"
              fill={bladeColor}
              stroke="#12151c"
              strokeWidth="2.5"
              opacity="0.85"
              transform={getBladeTransform(i)}
              style={{
                transformOrigin: '100px 100px',
                transition: isBlinking 
                  ? 'transform 60ms linear, fill 400ms cubic-bezier(0.16, 1, 0.3, 1)' 
                  : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), fill 400ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          ))}
        </g>

        {/* Lens reflection shine overlay */}
        <path
          d="M 40,40 Q 100,20 160,40"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          opacity="0.08"
          strokeLinecap="round"
        />
      </svg>
      
      {/* Dynamic breathing inline styles if not reduced motion */}
      <style>{`
        @keyframes breath {
          0%, 100% { transform: scale(0.985) rotate(0deg); }
          50% { transform: scale(1.015) rotate(2deg); }
        }
        .animate-breath {
          animation: breath 4.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
