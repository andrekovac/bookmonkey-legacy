import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Header from './components/Header.jsx';
import AppRoutes from './routes.jsx';
import * as session from './session';
import './styles/main.css';

class App extends React.Component {
  componentDidMount() {
    session.load();
  }

  render() {
    return (
      <BrowserRouter>
        <Header />
        <main className="container">
          <AppRoutes />
        </main>
        <footer className="footer">BookMonkey &middot; Ihr Buchladen</footer>
      </BrowserRouter>
    );
  }
}

export default App;
