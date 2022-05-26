import { Link } from 'react-router-dom';

const TopicsLayout = ({ children }: React.PropsWithChildren<{}>) => (
  <div>
    <Link to="/">Home</Link>
    <h1>Welcome to topics!</h1>
    <div>{children}</div>
  </div>
);

export default TopicsLayout;
