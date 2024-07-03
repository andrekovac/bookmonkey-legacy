import React from 'react';
import useLanguage from '../hooks/useLanguage';

// « zurück  1 2 [3] 4 … 9  weiter »
// total = X-Total-Count from the API. Without total (old API) only back/next.
function pages(current, last) {
  const out = [];
  for (let p = 1; p <= last; p++) {
    if (p === 1 || p === last || Math.abs(p - current) <= 2) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
}

export default function Pager({ page, total, pageSize, onPage, hasMore }) {
  const { t } = useLanguage();
  const last = total !== null && total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canNext = last !== null ? page < last : !!hasMore;

  return (
    <nav className="c-pager pager" aria-label={t('pager.label')}>
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1}>&laquo; {t('common.back')}</button>
      {last === null ? (
        <span className="pager-page">{t('catalogue.page', { page: page })}</span>
      ) : (
        <span className="c-pager__pages">
          {pages(page, last).map((p, i) =>
            p === '…' ? (
              <span key={'gap' + i} className="c-pager__gap">…</span>
            ) : (
              <button
                key={p}
                type="button"
                className={'c-pager__page' + (p === page ? ' is-current' : '')}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPage(p)}
              >
                {p}
              </button>
            )
          )}
        </span>
      )}
      <button type="button" onClick={() => onPage(page + 1)} disabled={!canNext}>{t('common.next')} &raquo;</button>
      {last !== null && <span className="c-pager__info u-muted">{t('pager.info', { total: total, pages: last })}</span>}
    </nav>
  );
}
