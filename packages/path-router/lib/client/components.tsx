import React, { createContext } from 'react';
import {
  useRoutes,
  useParams,
  createRoutesFromChildren,
  type RoutesProps,
  type Params,
  type RouteObject,
} from 'react-router-dom';
import { pathTree, pathList } from 'virtual:path-routes';
import { buildPathHashMap } from './utils';
import type { PathTreeNode } from './types';

export const PathHashMapContext = createContext(buildPathHashMap(pathList));

export type PageProps<P> = {
  params: P;
};

export interface RouteSession {}

export interface PageAuthenticateResult<TSession> {
  (session: TSession):
    | Promise<boolean | string | Page | undefined>
    | boolean
    | string
    | Page;
}

export interface Page<TParams = Params, TSession = RouteSession> {
  (props: PageProps<TParams>): JSX.Element;
  authenticate?: PageAuthenticateResult<TSession>;
}

type RoutePageProps = {
  src: string;
};

const RoutePage = ({ src }: RoutePageProps) => {
  const LoadedPage = React.lazy<Page>(
    () =>
      import(
        /* @vite-ignore */ `/vite-plugin-react-path-router/pages?id=${src}`
      )
  );
  const params = useParams();
  return (
    <React.Suspense fallback={<h1>Please wait...</h1>}>
      <LoadedPage params={params} />
    </React.Suspense>
  );
};

function createRoutesFromPathTreeNode(
  pathTreeNode: PathTreeNode
): RouteObject[] {
  const routes = new Array<RouteObject>();
  const pathTreeEntries = Object.entries(pathTreeNode);
  for (const [subroute, node] of pathTreeEntries) {
    if (typeof node === 'string') {
      if (subroute === '/') {
        // index route is already processed in the "else" statement, ignore
        continue;
      }
      // has no children, declare a route
      const route: RouteObject = {
        element: <RoutePage src={node} />,
        index: false,
        path: subroute,
      };
      routes.push(route);
    } else if (typeof node === 'object') {
      // need to fetch if there's an index in the children values
      const route: RouteObject = {
        element: node['/'] ? <RoutePage src={node['/']} /> : undefined,
        index: !!node['/'],
        children: createRoutesFromPathTreeNode(node),
      };
      routes.push(route);
    }
  }
  return routes;
}

const pathRoutes = createRoutesFromPathTreeNode(pathTree);

export interface PathRoutesProps extends RoutesProps {}

export const PathRoutes = ({ children, location }: PathRoutesProps) => {
  const routes = useRoutes(
    [...pathRoutes, ...createRoutesFromChildren(children)],
    location
  );
  return routes;
};
