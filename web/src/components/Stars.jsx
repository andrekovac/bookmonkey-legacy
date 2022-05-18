import React from 'react';

// ★★★☆☆, clickable when onChange is given
export default function Stars({ value, onChange, size }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const full = value >= i - 0.25;
    const half = !full && value >= i - 0.75;
    stars.push(
      <span
        key={i}
        className={'stars__star' + (full ? ' stars__star--full' : half ? ' stars__star--half' : '') + (onChange ? ' stars__star--click' : '')}
        onClick={onChange ? () => onChange(i) : undefined}
        title={onChange ? i + ' von 5' : undefined}
      >
        {full || half ? '★' : '☆'}
      </span>
    );
  }
  return <span className={'stars' + (size === 'big' ? ' stars--big' : '')}>{stars}</span>;
}
