import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

// react-router 6 only has hooks, our pages are classes
export default function withRouter(Component) {
  function Wrapped(props) {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    return <Component {...props} location={location} navigate={navigate} params={params} />;
  }
  Wrapped.displayName = 'withRouter(' + (Component.displayName || Component.name) + ')';
  return Wrapped;
}
