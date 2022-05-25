import './App.css';
import { BrowserRouter, Route } from 'react-router-dom';
import { PathRoutes } from 'vite-page-router';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <PathRoutes
          pages={import.meta.glob('./**/pages/**/*.(t|s)sx')}
          fallbackLayout={({ children }) => <div id="layout">{children}</div>}
        >
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
