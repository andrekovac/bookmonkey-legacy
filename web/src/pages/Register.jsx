import React from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';
import withRouter from '../components/withRouter.jsx';
import * as session from '../session';

class Register extends React.Component {
  constructor(props) {
    super(props);
    this.state = { name: '', email: '', password: '', password2: '', error: null, busy: false };
    this.onSubmit = this.onSubmit.bind(this);
  }

  onSubmit(e) {
    e.preventDefault();
    const { name, email, password, password2 } = this.state;
    if (!email || !password) {
      this.setState({ error: 'Bitte E-Mail und Passwort eingeben.' });
      return;
    }
    if (password.length < 6) {
      this.setState({ error: 'Das Passwort muss mindestens 6 Zeichen haben.' });
      return;
    }
    if (password !== password2) {
      this.setState({ error: 'Die Passwörter stimmen nicht überein.' });
      return;
    }
    this.setState({ busy: true, error: null });
    xhr.post('/auth/register', { name: name, email: email, password: password }, (err) => {
      if (err) {
        this.setState({
          busy: false,
          error: err.status === 409 ? 'Diese E-Mail ist schon registriert.' : err.message
        });
        return;
      }
      // cookie is set, load the user into the session store
      session.load(() => this.props.navigate('/'));
    });
  }

  field(name, label, type, autoComplete) {
    return (
      <label>
        {label}
        <input
          type={type || 'text'}
          value={this.state[name]}
          autoComplete={autoComplete}
          onChange={e => this.setState({ [name]: e.target.value })}
        />
      </label>
    );
  }

  render() {
    return (
      <div className="register">
        <h1>Kundenkonto anlegen</h1>
        <form onSubmit={this.onSubmit} className="form">
          {this.state.error && <div className="error">{this.state.error}</div>}
          {this.field('name', 'Name', 'text', 'name')}
          {this.field('email', 'E-Mail', 'email', 'username')}
          {this.field('password', 'Passwort', 'password', 'new-password')}
          {this.field('password2', 'Passwort wiederholen', 'password', 'new-password')}
          <button type="submit" className="primary" disabled={this.state.busy}>
            {this.state.busy ? 'Moment...' : 'Konto anlegen'}
          </button>
        </form>
        <p>
          Schon Kunde? <Link to="/login">Anmelden</Link>
        </p>
      </div>
    );
  }
}

export default withRouter(Register);
