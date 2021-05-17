import React from 'react';
import { Link } from 'react-router-dom';
import * as session from '../session';

class Header extends React.Component {
  constructor(props) {
    super(props);
    this.state = { user: session.getUser() };
    this.logout = this.logout.bind(this);
  }

  componentDidMount() {
    this.unsubscribe = session.subscribe(user => this.setState({ user: user }));
  }

  componentWillUnmount() {
    this.unsubscribe();
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
            {user ? (
              <span className="nav-user">
                <span className="nav-name">Hallo {user.name || user.email}</span>
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
