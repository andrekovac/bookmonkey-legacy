import React from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';
import withRouter from '../components/withRouter.jsx';
import * as cart from '../cart';
import * as session from '../session';
import { formatPrice } from '../utils/format';
import '../styles/cart.css';

class Checkout extends React.Component {
  constructor(props) {
    super(props);
    const user = session.getUser();
    this.state = {
      cart: cart.getCart(),
      form: {
        name: user ? user.name || '' : '',
        street: '',
        zip: '',
        city: '',
        payment: 'invoice',
        note: ''
      },
      error: null,
      busy: false,
      order: null
    };
    this.onSubmit = this.onSubmit.bind(this);
  }

  componentDidMount() {
    this.unsubscribe = cart.subscribe(c => this.setState({ cart: c }));
    cart.refresh((err) => {
      if (err && err.status === 401) this.props.navigate('/login?next=/checkout');
    });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  setField(name, value) {
    const form = Object.assign({}, this.state.form);
    form[name] = value;
    this.setState({ form: form });
  }

  validate() {
    const f = this.state.form;
    if (!f.name || !f.street || !f.city) return 'Bitte Name und Adresse vollständig ausfüllen.';
    if (!/^[0-9]{5}$/.test(f.zip)) return 'Bitte eine gültige PLZ eingeben.';
    return null;
  }

  onSubmit(e) {
    e.preventDefault();
    const problem = this.validate();
    if (problem) {
      this.setState({ error: problem });
      return;
    }
    this.setState({ busy: true, error: null });
    xhr.post('/orders', this.state.form, (err, order) => {
      if (err) {
        this.setState({ busy: false, error: err.message });
        return;
      }
      cart.refresh();
      this.setState({ busy: false, order: order });
      window.scrollTo(0, 0);
    });
  }

  renderDone() {
    const order = this.state.order;
    return (
      <div className="checkout-done">
        <h1>Vielen Dank!</h1>
        <p>
          Ihre Bestellung Nr. <b>{order.id}</b> über <b>{formatPrice(order.total_gross)}</b> ist eingegangen.
        </p>
        <p>
          {order.payment === 'prepayment'
            ? 'Bitte überweisen Sie den Betrag, wir versenden nach Zahlungseingang.'
            : 'Die Rechnung liegt der Lieferung bei.'}
        </p>
        <p>
          <Link to="/account">Meine Bestellungen</Link> &middot; <Link to="/">Weiter einkaufen</Link>
        </p>
      </div>
    );
  }

  render() {
    if (this.state.order) return this.renderDone();
    const { form, error, busy } = this.state;
    const items = this.state.cart.items;
    // Summe wie auf der Rechnung: erst netto summieren, dann 7 % MwSt (so rechnet POST /orders)
    let net = 0;
    items.forEach(i => { net += i.price_net * i.qty; });
    const totalNet = Math.round(net * 100) / 100;
    const sum = Math.round(totalNet * 1.07 * 100) / 100;
    const vat = Math.round((sum - totalNet) * 100) / 100;

    return (
      <div className="checkout">
        <h1>Kasse</h1>
        {error && <div className="error">{error}</div>}
        <div className="checkout-columns">
          <form className="form checkout-form" onSubmit={this.onSubmit}>
            <h3>Lieferadresse</h3>
            <label>Name<input value={form.name} onChange={e => this.setField('name', e.target.value)} /></label>
            <label>Straße und Hausnummer<input value={form.street} onChange={e => this.setField('street', e.target.value)} /></label>
            <div className="zip-city">
              <label className="zip">PLZ<input value={form.zip} maxLength="5" onChange={e => this.setField('zip', e.target.value)} /></label>
              <label className="city">Ort<input value={form.city} onChange={e => this.setField('city', e.target.value)} /></label>
            </div>
            <h3>Zahlung</h3>
            <label className="radio">
              <input type="radio" checked={form.payment === 'invoice'} onChange={() => this.setField('payment', 'invoice')} />
              Rechnung
            </label>
            <label className="radio">
              <input type="radio" checked={form.payment === 'prepayment'} onChange={() => this.setField('payment', 'prepayment')} />
              Vorkasse
            </label>
            <label>Anmerkung<textarea value={form.note} onChange={e => this.setField('note', e.target.value)} /></label>
            <button type="submit" className="primary" disabled={busy || items.length === 0}>
              {busy ? 'Moment...' : 'Zahlungspflichtig bestellen'}
            </button>
          </form>

          <div className="checkout-summary">
            <h3>Ihre Bestellung</h3>
            {items.length === 0 && <div className="empty">Warenkorb ist leer.</div>}
            <ul>
              {items.map(i => (
                <li key={i.isbn}>
                  {i.qty} &times; {i.title}
                  <span className="checkout-line">{formatPrice(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <div className="checkout-net">
              netto <span>{formatPrice(totalNet)}</span>
            </div>
            <div className="checkout-net">
              7 % MwSt. <span>{formatPrice(vat)}</span>
            </div>
            <div className="checkout-sum">
              Gesamt <span>{formatPrice(sum)}</span>
            </div>
            <div className="checkout-hint">versandkostenfrei</div>
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(Checkout);
