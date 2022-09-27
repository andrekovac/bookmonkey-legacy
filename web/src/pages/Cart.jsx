import React from 'react';
import { Link } from 'react-router-dom';
import xhr from '../api/xhr';
import withRouter from '../components/withRouter.jsx';
import * as cart from '../cart';
import { formatPrice } from '../utils/format';
import '../styles/cart.css';

class Cart extends React.Component {
  constructor(props) {
    super(props);
    this.state = { cart: cart.getCart(), loading: true, error: null };
  }

  componentDidMount() {
    this.unsubscribe = cart.subscribe(c => this.setState({ cart: c }));
    cart.refresh((err) => {
      if (err && err.status === 401) {
        this.props.navigate('/login?next=/cart');
        return;
      }
      this.setState({ loading: false, error: err ? err.message : null });
    });
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  changeQty(item, qty) {
    xhr.put('/cart/' + encodeURIComponent(item.isbn), { qty: qty }, (err) => {
      if (err) return this.setState({ error: err.message });
      cart.refresh();
    });
  }

  remove(item) {
    xhr.del('/cart/' + encodeURIComponent(item.isbn), (err) => {
      if (err) return this.setState({ error: err.message });
      cart.refresh();
    });
  }

  total() {
    let sum = 0;
    this.state.cart.items.forEach(function (item) {
      sum += item.line_total;
    });
    return sum;
  }

  render() {
    const { loading, error } = this.state;
    const items = this.state.cart.items;
    if (loading) return <div className="loading">Lade Warenkorb...</div>;

    return (
      <div className="cart">
        <h1>Warenkorb</h1>
        {error && <div className="error">{error}</div>}
        {items.length === 0 ? (
          <div className="empty">
            Ihr Warenkorb ist leer. <Link to="/">Weiter einkaufen</Link>
          </div>
        ) : (
          <div>
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Buch</th>
                  <th className="num">Einzelpreis</th>
                  <th className="num">Menge</th>
                  <th className="num">Summe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.isbn}>
                    <td>
                      <Link to={'/books/' + item.isbn}>{item.title}</Link>
                      <div className="cart-author">{item.author}</div>
                    </td>
                    <td className="num">
                      {formatPrice(item.price_gross)}
                      {item.discount && <div className="cart-discount">-{Math.round(item.discount * 100)} %</div>}
                    </td>
                    <td className="num">
                      <select value={item.qty} onChange={e => this.changeQty(item, parseInt(e.target.value, 10))}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td className="num">{formatPrice(item.line_total)}</td>
                    <td>
                      <button className="link-button" onClick={() => this.remove(item)}>entfernen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" className="num">Gesamt (inkl. MwSt.)</td>
                  <td className="num cart-total">{formatPrice(this.total())}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="cart-actions">
              <Link to="/">Weiter einkaufen</Link>
              <button className="primary" onClick={() => this.props.navigate('/checkout')}>Zur Kasse</button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default withRouter(Cart);
