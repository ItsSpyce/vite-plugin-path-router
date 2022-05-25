import { PropsWithChildren } from 'react';

const TestNamespaceLayout = ({ children }: PropsWithChildren<{}>) => (
  <div>
    <h1>This is from the test namespace!</h1>
    <br />
    {children}
  </div>
);

export default TestNamespaceLayout;
