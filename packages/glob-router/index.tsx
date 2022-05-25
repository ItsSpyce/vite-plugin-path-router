import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  useRoutes,
  useParams,
  useLocation,
  matchPath,
  createRoutesFromChildren,
  type RoutesProps,
  type Params,
  type RouteObject,
  type Location,
} from 'react-router-dom';
import { match, type MatchFunction } from 'path-to-regexp';
import _debug from 'debug';
const debug = _debug('path-router');

/// Types
interface PageModule {
  default: React.ComponentType<PageProps<Params>>;
  authenticate?: GetAuthenticate;
}

interface DynamicImport {
  (): Promise<any>;
}

type GlobImport = {
  [filename: string]: DynamicImport;
};

export type CasingOpts = {
  separator?: string | false;
};

export type PageProps<P> = {
  params: P;
};

export interface RouteSession {}

export interface GetAuthenticate {
  (session: RouteSession):
    | Promise<boolean | string | Page | void | undefined>
    | boolean
    | string
    | Page
    | void
    | undefined;
}

export interface LayoutResultProps extends React.PropsWithChildren<{}> {}

export interface GetLayout {
  (props: LayoutResultProps): React.ReactElement;
}

export interface Page<TParams = Params> {
  (props: PageProps<TParams>): React.ReactElement;
}

type PathRouteComponentType = 'notFound' | 'notAuthorized' | 'error' | 'layout';

type PathRouteComponent = {
  [type in PathRouteComponentType]?: DynamicImport;
};

/// Contexts

export const FileRoutingContext = createContext<FileRoutingController | null>(
  null
);
export const FallbackLayoutContext = createContext<GetLayout | null>(null);

/// Components

function EmptyLayout({ children }: React.PropsWithChildren<{}>) {
  return <>{children}</>;
}

export interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

export interface RouteErrorBoundaryState {
  error?: unknown;
}

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {};
  }

  componentDidCatch(error: unknown) {
    this.setState({
      error,
    });
  }

  render() {
    const { error } = this.state;
    return (
      <>
        {error && <span>{`${error}`}</span>}
        {!error && this.props.children}
      </>
    );
  }
}

export interface PageWrapperProps {
  moduleFn: DynamicImport;
}

export function PageWrapper({ moduleFn }: PageWrapperProps) {
  const Page = React.lazy(moduleFn);
  const params = useParams();
  const [mod, setMod] = useState<PageModule | undefined>();
  useEffect(() => {
    moduleFn().then((mod) => {
      setMod(mod);
      const { authenticate } = mod;
    });
  }, []);
  useEffect(() => {}, []);

  return (
    <RouteErrorBoundary>
      <React.Suspense>
        <Page params={params} />
      </React.Suspense>
    </RouteErrorBoundary>
  );
}

export interface NotFoundProps {}

export function NotFound(_: NotFoundProps) {
  const location = useLocation();
  const fileRoutingController = useContext(FileRoutingContext);
  const notFoundImport = fileRoutingController?.getPathComponentFor(
    location.pathname,
    'notFound'
  );
  if (!notFoundImport) {
    return <>TODO: fallback NotFound</>;
  }
  const NotFoundComponent = React.lazy(notFoundImport);

  return (
    <React.Suspense>
      <NotFoundComponent />
    </React.Suspense>
  );
}

interface LayoutContainerProps extends React.PropsWithChildren<{}> {}

function LayoutContainer({ children }: LayoutContainerProps) {
  const location = useLocation();
  const fileRoutingController = useContext(FileRoutingContext);
  const FallbackLayout = useContext(FallbackLayoutContext);
  const [CurrentLayout, setCurrentLayout] = useState<
    React.ComponentType<LayoutResultProps>
    //@ts-ignore because Lazy components aren't seen as component types??
  >(() => {
    const fromRoute = fileRoutingController?.getPathComponentFor(
      location.pathname,
      'layout'
    );
    if (fromRoute) {
      return React.lazy(fromRoute);
    }
    if (FallbackLayout) {
      return FallbackLayout;
    }
    return EmptyLayout;
  });
  useEffect(() => {
    const layoutFromLocation = fileRoutingController?.getPathComponentFor(
      location.pathname,
      'layout'
    );
    if (layoutFromLocation) {
      setCurrentLayout(React.lazy(layoutFromLocation));
    }
  }, [location]);

  return (
    <React.Suspense>
      <CurrentLayout>{children}</CurrentLayout>
    </React.Suspense>
  );
}

export interface PathRoutesProps extends RoutesProps {
  pages: GlobImport;
  fallbackLayout?: GetLayout;
}

export function PathRoutes({
  children,
  pages,
  location,
  fallbackLayout,
}: PathRoutesProps) {
  const [fileRoutingContext] = useState(new FileRoutingController(pages));
  const resolvedRoutes = useRoutes(
    [
      ...fileRoutingContext.buildRoutes(),
      ...createRoutesFromChildren(children),
    ],
    location
  );

  return (
    <FallbackLayoutContext.Provider value={fallbackLayout || null}>
      <FileRoutingContext.Provider value={fileRoutingContext}>
        <LayoutContainer>{resolvedRoutes}</LayoutContainer>
      </FileRoutingContext.Provider>
    </FallbackLayoutContext.Provider>
  );
}

/// Utils

export function getRouteFromFilename(
  filename: string,
  opts?: CasingOpts
): string {
  const separator = opts?.separator === false ? '' : opts?.separator || '-';
  const cleaned = filename
    // remove pages/ from name
    .replaceAll(/(pages)\//g, '')
    // remove ./ from beginning
    .replace(/^\.\//, '')
    // removing index
    .replaceAll(/\/?index/g, '/')
    // remove file extension
    .replaceAll(/(\.(?:j|t)sx?)$/g, '')
    // fix casing
    .replaceAll(
      /([a-z])([A-Z])([a-z])/g,
      (_, p1, p2, p3) => `${p1}${separator}${p2.toLowerCase()}${p3}`
    )
    // transform dynamic routes from [param] to :param
    .replaceAll(/\[([A-Za-z_-]+)\]/g, ':$1')
    // remove trailing slashes
    .replace(/\/*$/, '');
  return cleaned === '' ? '/' : cleaned;
}

const reservedPaths: PathRouteComponentType[] = [
  'layout',
  'notFound',
  'notAuthorized',
  'error',
];

function getParentDir(filename: string) {
  const dirSeparator = filename.includes('/') ? '/' : '\\';
  return filename.substring(0, filename.lastIndexOf(dirSeparator));
}

function getFilename(path: string, includeExt?: boolean) {
  const lastSlash = path.lastIndexOf('/') + 1;
  if (includeExt) {
    return path.substring(lastSlash + 1);
  }
  return path.substring(lastSlash, path.lastIndexOf('.'));
}

class FileRoutingController {
  private _pathRouteComponents: Record<string, PathRouteComponent> = {};
  private _matchers: Record<string, MatchFunction> = {};
  private _routes: Record<string, RouteObject> = {};
  private _isBuilt = false;

  constructor(private _globImports: GlobImport) {}

  buildRoutes(): RouteObject[] {
    if (this._isBuilt) {
      return Object.values(this._routes);
    }
    const routes: Record<string, RouteObject> = {};
    for (const [path, importFn] of Object.entries(this._globImports)) {
      const routePath = getRouteFromFilename(path);
      const filename = getFilename(path);
      if (reservedPaths.includes(filename as PathRouteComponentType)) {
        continue;
      }
      if (!!routes[routePath]) {
        continue;
      }
      const pathRouteComponent: PathRouteComponent = [...reservedPaths].reduce(
        (acc, pathRouteComponentType) => {
          const foundComponentType = this.findNearestComponentType(
            path,
            pathRouteComponentType
          );
          if (foundComponentType === false) {
            return acc;
          }
          return {
            ...acc,
            [pathRouteComponentType]: foundComponentType,
          };
        },
        {}
      );
      this._pathRouteComponents[routePath] = pathRouteComponent;
      routes[routePath] = {
        element: React.createElement(PageWrapper, { moduleFn: importFn }),
        path: routePath === '' ? '/' : routePath,
      };
      this._matchers[routePath] = match(routePath, {
        decode: decodeURIComponent,
      });
    }
    this._isBuilt = true;
    this._routes = routes;
    return Object.values(routes);
  }

  getPathComponentFor(
    route: string,
    pathRouteComponentType: PathRouteComponentType
  ) {
    console.log(
      `Getting path component type ${pathRouteComponentType} for ${route}`
    );
    const cleanedRoute = route.replace(/^\//, '');
    for (const [routePath, matcher] of Object.entries(this._matchers)) {
      if (!matcher(cleanedRoute)) {
        console.log(`No match made for ${routePath}`);
        continue;
      }
      const pathRouteComponent = this._pathRouteComponents[routePath];
      if (!pathRouteComponent) {
        console.error(
          `No path components found for ${route} (match ${routePath})`
        );
      }
      return pathRouteComponent[pathRouteComponentType];
    }
  }

  private findNearestComponentType(
    relativeFilename: string,
    pathRouteComponentType: PathRouteComponentType
  ) {
    let currentDir = getParentDir(relativeFilename);
    const filenames = Object.keys(this._globImports);
    do {
      // since there should only be 1 match per dir, we only have to check once
      const match = filenames.find((filename) => {
        return new RegExp(
          `^${currentDir}/${pathRouteComponentType}\\.(j|t)sx?$`,
          'i'
        ).test(filename);
      });
      if (match) {
        debug(`Match found for ${relativeFilename} at ${match}`);
        return this._globImports[match];
      }
    } while (currentDir !== (currentDir = getParentDir(relativeFilename)));
    return false;
  }
}
