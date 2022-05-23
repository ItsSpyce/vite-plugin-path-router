import { useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { BrowserRouter, Route, Link } from 'react-router-dom';
import { PathRoutes } from 'vite-plugin-react-path-router/client';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Link to="/">Home</Link>
        <br />
        <Link to="dynamic-route">Dynamic Route</Link>
        <br />
        <Link to="other-dynamic-route">Other Dynamic Route</Link>
        <PathRoutes>
          <Route
            path="dynamic-route"
            element={<h1>This is a dynamic route!</h1>}
          />
          <Route
            path="other-dynamic-route"
            element={<h1>This is the other dynamic route</h1>}
          />
        </PathRoutes>
      </BrowserRouter>
    </div>
  );
}

export default App;
