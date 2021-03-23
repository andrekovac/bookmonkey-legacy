import React from 'react';
import xhr from '../api/xhr';

class PublisherFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { publishers: [] };
  }

  componentDidMount() {
    xhr.get('/publishers', (err, data) => {
      if (err) return console.error('publishers', err);
      this.setState({ publishers: data });
    });
  }

  render() {
    return (
      <select
        className="publisher-filter"
        value={this.props.value}
        onChange={e => this.props.onChange(e.target.value)}
      >
        <option value="">Alle Verlage</option>
        {this.state.publishers.map(p => (
          <option key={p.publisher} value={p.publisher}>
            {p.publisher} ({p.count})
          </option>
        ))}
      </select>
    );
  }
}

export default PublisherFilter;
