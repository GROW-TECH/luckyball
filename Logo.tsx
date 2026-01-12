
import React from 'react';

export const Logo: React.FC<{ className?: string, size?: 'sm' | 'md' | 'lg' }> = ({ className, size = 'md' }) => {
  const height = size === 'sm' ? '26px' : size === 'lg' ? '84px' : '42px';
  return (
    <svg viewBox="0 0 1120 250" className={className} style={{ height, width: 'auto', display: 'block' }}>
      <defs>
        <radialGradient id="gradRed" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#ff5f5f" /><stop offset="100%" stopColor="#8b0000" /></radialGradient>
        <radialGradient id="gradYellow" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#fff200" /><stop offset="100%" stopColor="#ca8a04" /></radialGradient>
        <radialGradient id="gradWhite" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#d1d1d1" /></radialGradient>
        <radialGradient id="gradGreen" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#00ff00" /><stop offset="100%" stopColor="#006400" /></radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" /><feOffset dx="0" dy="5" result="offsetblur" /><feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="110" cy="125" r="90" fill="url(#gradRed)" /><circle cx="80" cy="95" r="20" fill="white" fillOpacity="0.3" /><text x="110" y="155" textAnchor="middle" fill="white" fontSize="120" fontWeight="900" style={{fontFamily: 'Arial Black, sans-serif'}}>L</text>
        <circle cx="290" cy="125" r="90" fill="url(#gradYellow)" /><circle cx="260" cy="95" r="20" fill="white" fillOpacity="0.4" /><text x="290" y="155" textAnchor="middle" fill="black" fontSize="120" fontWeight="900" style={{fontFamily: 'Arial Black, sans-serif'}}>U</text>
        <circle cx="470" cy="125" r="90" fill="url(#gradWhite)" /><circle cx="440" cy="95" r="20" fill="white" fillOpacity="0.8" /><text x="470" y="155" textAnchor="middle" fill="black" fontSize="120" fontWeight="900" style={{fontFamily: 'Arial Black, sans-serif'}}>C</text>
        <circle cx="650" cy="125" r="90" fill="url(#gradWhite)" /><circle cx="620" cy="95" r="20" fill="white" fillOpacity="0.8" /><text x="650" y="155" textAnchor="middle" fill="black" fontSize="120" fontWeight="900" style={{fontFamily: 'Arial Black, sans-serif'}}>K</text>
        <circle cx="830" cy="125" r="90" fill="url(#gradGreen)" /><circle cx="800" cy="95" r="20" fill="white" fillOpacity="0.4" /><text x="830" y="155" textAnchor="middle" fill="white" fontSize="120" fontWeight="900" style={{fontFamily: 'Arial Black, sans-serif'}}>Y</text>
        <circle cx="1010" cy="125" r="90" fill="url(#gradRed)" /><path d="M930,125 Q1010,200 1090,125" fill="#ffcc00" fillOpacity="0.8" /><text x="1010" y="145" textAnchor="middle" fill="white" fontSize="50" fontWeight="900" style={{fontFamily: 'Arial Black, sans-serif'}}>BALL</text>
      </g>
    </svg>
  );
};
