import { type Page, NotFound } from 'vite-page-router';

type TopicPageParams = {
  topic: 'A' | 'B';
};

const TopicPage: Page<TopicPageParams> = ({ params }) => (
  <>
    {params.topic !== 'A' && <NotFound />}
    {params.topic === 'A' && <h1>We passed the topic test: {params.topic}</h1>}
  </>
);

export default TopicPage;
