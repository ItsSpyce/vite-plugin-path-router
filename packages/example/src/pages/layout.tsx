import { useState } from 'react';
import type { GetLayout } from 'vite-page-router';
import Layout from '../layouts';

const MainLayout: GetLayout = ({ children }) => {
  const [v] = useState(Math.random());
  return (
    <Layout>
      <span>Layout ID: {v}</span>
      {children}
    </Layout>
  );
};

export default MainLayout;
