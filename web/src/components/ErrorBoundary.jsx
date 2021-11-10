import React from 'react';

// catches render errors so the whole shop does not go blank
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error };
  }

  componentDidCatch(error, info) {
    console.error('render error', error, info && info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error">
          Da ist etwas schiefgelaufen. Bitte laden Sie die Seite neu.
          <div>
            <a href="/">Zur Startseite</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
