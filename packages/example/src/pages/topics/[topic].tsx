import { type Page } from 'vite-plugin-react-path-router/client';

const TopicPage: Page = ({ params }) => <h1>Topic: {params.topic}</h1>;

export default TopicPage;
