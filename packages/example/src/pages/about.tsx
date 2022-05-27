import type { GetAuthenticate } from 'vite-page-router';

const AboutPage = () => <h1>About</h1>;

export const authenticate: GetAuthenticate = () => {
  // for now, we'll have it based on random chance :)
  const r = Math.random();
  if (r >= 0.5) {
    // allowing return of undefined to showcase functionality
    return true;
  }
};

export default AboutPage;
