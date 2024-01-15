import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Header from './components/Header.jsx';
import AppRoutes from './routes.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import * as session from './session';
import { getLanguage, subscribe as onLanguage, t } from './i18n';
import './styles/main.css';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { lang: getLanguage() };
  }

  componentDidMount() {
    document.documentElement.lang = this.state.lang;
    this.unsubscribe = onLanguage(lang => this.setState({ lang: lang }));
    session.load();
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  render() {
    return (
      <BrowserRouter>
        <Header />
        <main className="container">
          {/* key: the class pages read t() in render only, a new key renders them again in the new language */}
          <ErrorBoundary key={this.state.lang}>
            <AppRoutes />
          </ErrorBoundary>
        </main>
        <footer className="footer">{t('footer')}</footer>
      </BrowserRouter>
    );
  }
}

export default App;
