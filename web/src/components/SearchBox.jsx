import React from 'react';

class SearchBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: props.value || '' };
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onClear = this.onClear.bind(this);
  }

  onChange(e) {
    this.setState({ value: e.target.value });
  }

  onSubmit(e) {
    e.preventDefault();
    this.props.onSearch(this.state.value.trim());
  }

  onClear() {
    this.setState({ value: '' });
    this.props.onSearch('');
  }

  render() {
    return (
      <form className="search-box" onSubmit={this.onSubmit}>
        <input
          type="search"
          placeholder="Titel oder Autor..."
          aria-label="Suche"
          value={this.state.value}
          onChange={this.onChange}
        />
        <button type="submit" className="primary">Suchen</button>
        {this.state.value && (
          <button type="button" onClick={this.onClear}>
            Zurücksetzen
          </button>
        )}
      </form>
    );
  }
}

export default SearchBox;
