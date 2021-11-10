import React from 'react';
import xhr from '../api/xhr';
import * as session from '../session';

class ProfileForm extends React.Component {
  constructor(props) {
    super(props);
    const user = session.getUser() || {};
    this.state = {
      name: user.name || '',
      currentPassword: '',
      password: '',
      message: null,
      error: null
    };
    this.onSubmit = this.onSubmit.bind(this);
  }

  onSubmit(e) {
    e.preventDefault();
    const body = { name: this.state.name };
    if (this.state.password) {
      body.password = this.state.password;
      body.currentPassword = this.state.currentPassword;
    }
    this.setState({ message: null, error: null });
    xhr.put('/auth/me', body, (err) => {
      if (err) {
        this.setState({ error: err.message });
        return;
      }
      session.load();
      this.setState({ message: 'Gespeichert.', password: '', currentPassword: '' });
    });
  }

  render() {
    return (
      <form className="form profile-form" onSubmit={this.onSubmit}>
        <h2>Profil</h2>
        {this.state.message && <div className="success">{this.state.message}</div>}
        {this.state.error && <div className="error">{this.state.error}</div>}
        <label>
          Name
          <input value={this.state.name} onChange={e => this.setState({ name: e.target.value })} />
        </label>
        <label>
          Aktuelles Passwort
          <input
            type="password"
            value={this.state.currentPassword}
            autoComplete="current-password"
            onChange={e => this.setState({ currentPassword: e.target.value })}
          />
        </label>
        <label>
          Neues Passwort
          <input
            type="password"
            value={this.state.password}
            autoComplete="new-password"
            onChange={e => this.setState({ password: e.target.value })}
          />
        </label>
        <button type="submit">Speichern</button>
      </form>
    );
  }
}

export default ProfileForm;
