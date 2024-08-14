import React, { useEffect, useState } from 'react';
import Catalogue from '../pages/Catalogue.jsx';
import CatalogueNew from '../pages/CatalogueNew.jsx';
import { loadFlags } from '../hooks/useFlags';
import { t } from '../i18n';

// "/" shows the new search when ENABLE_NEW_SEARCH is on, otherwise the old catalogue page
export default function CatalogueSwitch() {
  const [flags, setFlags] = useState(null);
  useEffect(() => {
    loadFlags().then(setFlags);
  }, []);
  if (!flags) return <div className="loading">{t('common.loading')}</div>;
  return flags.ENABLE_NEW_SEARCH ? <CatalogueNew /> : <Catalogue />;
}
