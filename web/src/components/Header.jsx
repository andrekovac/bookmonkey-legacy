import React from 'react';
import { Link } from 'react-router-dom';
import * as session from '../session';
import * as cart from '../cart';

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
  }

  componentWillUnmount() {
    this.unsubscribe();
    this.unsubscribeCart();
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
            <Link to="/">Katalog</Link>
            {user && <Link to="/cart" className="nav-cart">Warenkorb ({this.state.count})</Link>}
            {user ? (
              <span className="nav-user">
                <Link to="/account" className="nav-name">{user.name || user.email}</Link>
                <a href="/logout" onClick={this.logout}>Abmelden</a>
              </span>
            ) : (
              <Link to="/login">Anmelden</Link>
            )}
          </nav>
        </div>
      </header>
    );
  }
}

export default Header;
