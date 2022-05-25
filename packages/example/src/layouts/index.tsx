import React from 'react';
import { Link } from 'react-router-dom';

const Layout = ({ children }: React.PropsWithChildren<{}>) => (
  <div className="layout">
    <div className="navbar">
      <ul className="navbar-items">
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/dynamic-route">Dynamic Route</Link>
        </li>
        <li>
          <Link to="/topics/A">Example topic A</Link>
        </li>
        <li>
          <Link to="/topics/B">Example topic B</Link>
        </li>
      </ul>
    </div>
    <div className="layout-body">{children}</div>
  </div>
);

export default Layout;
