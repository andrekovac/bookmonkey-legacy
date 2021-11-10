import React from 'react';
import { Link } from 'react-router-dom';
import withRouter from '../components/withRouter.jsx';
import * as session from '../session';

class Login extends React.Component {
  constructor(props) {
    super(props);
    this.state = { email: '', password: '', error: null, busy: false };
    this.onSubmit = this.onSubmit.bind(this);
  }

  nextUrl() {
    const params = new URLSearchParams(this.props.location.search);
    const next = params.get('next');
    // only local redirects
    return next && next.charAt(0) === '/' ? next : '/';
  }

  onSubmit(e) {
    e.preventDefault();
    if (!this.state.email || !this.state.password) {
      this.setState({ error: 'Bitte E-Mail und Passwort eingeben.' });
      return;
    }
    this.setState({ busy: true, error: null });
    session.login(this.state.email, this.state.password, (err) => {
      if (err) {
        this.setState({
          busy: false,
          error: err.status === 401 ? 'E-Mail oder Passwort falsch.' : err.message
        });
        return;
      }
      this.props.navigate(this.nextUrl());
    });
  }

  render() {
    return (
      <div className="login">
        <h1>Anmelden</h1>
        <form onSubmit={this.onSubmit} className="form">
          {this.state.error && <div className="error">{this.state.error}</div>}
          <label>
            E-Mail
            <input
              type="email"
              value={this.state.email}
              autoComplete="username"
              onChange={e => this.setState({ email: e.target.value })}
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              value={this.state.password}
              autoComplete="current-password"
              onChange={e => this.setState({ password: e.target.value })}
            />
          </label>
          <button type="submit" className="primary" disabled={this.state.busy}>
            {this.state.busy ? 'Moment...' : 'Anmelden'}
          </button>
        </form>
        <p>
          Neu bei BookMonkey? <Link to="/register">Kundenkonto anlegen</Link>
        </p>
      </div>
    );
  }
}

export default withRouter(Login);
