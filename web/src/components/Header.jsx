import React from 'react';
import { Link } from 'react-router-dom';

class Header extends React.Component {
  render() {
    return (
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            BookMonkey
          </Link>
          <nav className="nav">
            <Link to="/">Katalog</Link>
          </nav>
        </div>
      </header>
    );
  }
}

export default Header;
