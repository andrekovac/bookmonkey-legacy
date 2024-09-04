import React from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';
import withRouter from '../components/withRouter.jsx';
import * as session from '../session';
import ProfileForm from '../components/ProfileForm.jsx';
import AccountLoans from '../components/AccountLoans.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import '../styles/library.css';
import { formatDate, formatPrice } from '../utils/format';

const STATUS = {
  new: 'Eingegangen',
  paid: 'Bezahlt',
  shipped: 'Versendet',
  cancelled: 'Storniert'
};

class Account extends React.Component {
  constructor(props) {
    super(props);
    this.state = { orders: [], open: null, loading: true, error: null };
  }

  componentDidMount() {
    xhr.get('/orders', (err, orders) => {
      if (err && err.status === 401) {
        this.props.navigate('/login?next=/account');
        return;
      }
      this.setState({ loading: false, orders: orders || [], error: err ? err.message : null });
    });
  }

  toggle(id) {
    if (this.state.open && this.state.open.id === id) {
      this.setState({ open: null });
      return;
    }
    xhr.get('/orders/' + id, (err, order) => {
      if (err) return this.setState({ error: err.message });
      this.setState({ open: order });
    });
  }

  render() {
    const user = session.getUser();
    const { orders, open, loading, error } = this.state;
    return (
      <div className="account">
        <h1>Mein Konto</h1>
        {user && <p>{user.name} &lt;{user.email}&gt;</p>}
        {user && <ProfileForm />}
        {user && <NotificationSettings />}
        {user && <AccountLoans />}
        <h2>Bestellungen</h2>
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Lade...</div>}
        {!loading && orders.length === 0 && (
          <div className="empty">Noch keine Bestellungen. <Link to="/">Zum Katalog</Link></div>
        )}
        <table className="cart-table">
          <tbody>
            {orders.map(o => (
              <React.Fragment key={o.id}>
                <tr className="order-row" onClick={() => this.toggle(o.id)}>
                  <td>Nr. {o.id}</td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>{STATUS[o.status] || o.status}</td>
                  <td className="num">{formatPrice(o.total_gross)}</td>
                </tr>
                {open && open.id === o.id && (
                  <tr className="order-details">
                    <td colSpan="4">
                      <ul>
                        {open.items.map(i => (
                          <li key={i.isbn}>{i.qty} &times; <Link to={'/books/' + i.isbn}>{i.title}</Link></li>
                        ))}
                      </ul>
                      <div>Lieferung an: {open.ship_name}, {open.ship_street}, {open.ship_zip} {open.ship_city}</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

export default withRouter(Account);
