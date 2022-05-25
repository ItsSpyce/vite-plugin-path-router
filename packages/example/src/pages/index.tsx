import type { GetLayout } from 'vite-page-router';
import '../App.css';
import Layout from '../layouts';
import logo from '../logo.svg';

const HomePage = () => (
  <header className="App-header">
    <img src={logo} className="App-logo" alt="logo" />
    <p>Hello Vite + React!</p>
  </header>
);

export const getLayout: GetLayout = ({ children }) => (
  <Layout>{children}</Layout>
);

export default HomePage;
