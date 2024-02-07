import React from 'react';
import { Link } from 'react-router-dom';
import * as session from '../session';
import * as cart from '../cart';
import { t, subscribe as onLanguage } from '../i18n';
import LanguageSwitch from './LanguageSwitch.jsx';

class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = { user: session.getUser(), count: cart.getCart().count };
    this.logout = this.logout.bind(this);
  }

  componentDidMount() {
    this.unsubscribe = session.subscribe(user => {
      this.setState({ user: user });
      if (user) cart.refresh();
      else cart.clear();
    });
    this.unsubscribeCart = cart.subscribe(c => this.setState({ count: c.count }));
    // api/client.js: a request came back with 401 -> session cookie is gone, reload "me"
    this.onUnauthorized = () => {
      if (this.state.user) session.load();
    };
    window.addEventListener('bm:unauthorized', this.onUnauthorized);
    this.unsubscribeLanguage = onLanguage(() => this.forceUpdate());
  }

  componentWillUnmount() {
    this.unsubscribe();
    this.unsubscribeCart();
    window.removeEventListener('bm:unauthorized', this.onUnauthorized);
    this.unsubscribeLanguage();
  }

  logout(e) {
    e.preventDefault();
    session.logout(() => {
      window.location.href = '/';
    });
  }

  render() {
    const user = this.state.user;
    return (
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            BookMonkey
          </Link>
          <nav className="nav">
            <Link to="/">{t('nav.catalogue')}</Link>
            {user && <Link to="/loans">{t('nav.loans')}</Link>}
            {user && <Link to="/reservations">{t('nav.reservations')}</Link>}
            {user && <Link to="/wishlist">{t('nav.wishlist')}</Link>}
            {user && user.role === 'admin' && <Link to="/admin/loans">{t('nav.admin')}</Link>}
            {user && <Link to="/cart" className="nav-cart">{t('nav.cart', { count: this.state.count })}</Link>}
            {user ? (
              <span className="nav-user">
                <Link to="/account" className="nav-name">{user.name || user.email}</Link>
                <a href="/logout" onClick={this.logout}>{t('nav.logout')}</a>
              </span>
            ) : (
              <Link to="/login">{t('nav.login')}</Link>
            )}
            <LanguageSwitch />
          </nav>
        </div>
      </header>
    );
  }
}

export default Header;
