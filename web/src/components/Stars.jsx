import React from 'react';

// ★★★☆☆, clickable when onChange is given (then the stars are radio buttons for screen readers)
export default function Stars({ value, onChange, size }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const full = value >= i - 0.25;
    const half = !full && value >= i - 0.75;
    const className = 'stars__star' + (full ? ' stars__star--full' : half ? ' stars__star--half' : '') + (onChange ? ' stars__star--click' : '');
    if (onChange) {
      stars.push(
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={i + ' von 5 Sternen'}
          className={className + ' stars__button'}
          onClick={() => onChange(i)}
          onKeyDown={e => {
            if (e.key === 'ArrowRight' && i < 5) onChange(i + 1);
            if (e.key === 'ArrowLeft' && i > 1) onChange(i - 1);
          }}
        >
          {full || half ? '★' : '☆'}
        </button>
      );
    } else {
      stars.push(
        <span key={i} className={className} aria-hidden="true">
          {full || half ? '★' : '☆'}
        </span>
      );
    }
  }
  return (
    <span
      className={'stars' + (size === 'big' ? ' stars--big' : '')}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={onChange ? 'Bewertung' : (value ? String(value).replace('.', ',') : 0) + ' von 5 Sternen'}
    >
      {stars}
    </span>
  );
}
