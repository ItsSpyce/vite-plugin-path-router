import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
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
  type PathMatch,
} from 'react-router-dom';
import _debug from 'debug';
//const debug = _debug('path-router');
const debug = console.log;

/// Types

interface MatchFunction {
  (route: string): PathMatch | null;
}

type PathRouteComponentMap = {
  [routePattern: string]: PathRouteComponent;
};

type MatcherMap = {
  [routePattern: string]: MatchFunction;
};

type RoutesMap = {
  [filename: string]: RouteObject;
};

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
  [type in PathRouteComponentType]: DynamicImport;
};

/// Contexts

//@ts-ignore
export const FileRoutingContext = createContext<FileRoutingController>();
export const PathRouteContext = createContext('/');

/// Components

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

function EmptyPageComponent({ children }: PropsWithChildren<{}>) {
  return <>{children}</>;
}

export interface NotFoundProps {}

export function NotFound(_: NotFoundProps) {
  const NotFoundComponent = usePathComponent('notFound');

  return (
    <React.Suspense>
      <NotFoundComponent />
    </React.Suspense>
  );
}

interface LayoutContainerProps extends React.PropsWithChildren<{}> {}

function LayoutContainer({ children }: LayoutContainerProps) {
  const CurrentLayout = usePathComponent('layout');

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
  location: _location,
  fallbackLayout,
}: PathRoutesProps) {
  const location = useLocation();
  const [routePath, setRoutePath] = useState(
    typeof _location === 'string' ? _location : _location?.pathname || '/'
  );
  const [fileRoutingController] = useState(new FileRoutingController(pages));
  const resolvedRoutes = useRoutes(
    [
      ...fileRoutingController.buildRoutes(),
      ...createRoutesFromChildren(children),
    ],
    _location
  );

  useEffect(() => {
    const newRoutePath = fileRoutingController.getRouteMatch(location.pathname);
    if (newRoutePath !== routePath) {
      setRoutePath(newRoutePath);
      debug(`Route path changed from ${routePath} to ${newRoutePath}`);
    }
  }, [location.pathname]);

  return (
    <PathRouteContext.Provider value={routePath}>
      <FileRoutingContext.Provider value={fileRoutingController}>
        <LayoutContainer>{resolvedRoutes}</LayoutContainer>
      </FileRoutingContext.Provider>
    </PathRouteContext.Provider>
  );
}

/// Hooks

export function useRoutePath() {
  return useContext(PathRouteContext);
}

export function usePathComponent(pathComponentType: PathRouteComponentType) {
  const routePath = useRoutePath();
  const fileRoutingController = useContext(FileRoutingContext);
  console.log({ routePath, fileRoutingController });
  const [pathComponent, setPathComponent] = useState(() =>
    fileRoutingController.getPathComponentFor(routePath, pathComponentType)
  );

  useEffect(() => {
    const newPathComponent = fileRoutingController.getPathComponentFor(
      routePath,
      pathComponentType
    );
    if (newPathComponent !== setPathComponent) {
      setPathComponent(newPathComponent);
    }
  }, [routePath, pathComponentType]);

  return React.lazy(pathComponent);
}

/// Utils

const emptyComponentTypeImport = () =>
  Promise.resolve({ default: EmptyPageComponent });

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

function match(routePattern: string): MatchFunction {
  const pattern = `${routePattern}`;
  return (route: string) => matchPath(pattern, route);
}

class FileRoutingController {
  private _pathRouteComponents: PathRouteComponentMap = {};
  private _matchers: MatcherMap = {};
  private _routes: RoutesMap = {};
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
      const pathRouteComponent: PathRouteComponent = {
        layout: this.findNearestComponentType(path, 'layout'),
        error: this.findNearestComponentType(path, 'error'),
        notFound: this.findNearestComponentType(path, 'notFound'),
        notAuthorized: this.findNearestComponentType(path, 'notAuthorized'),
      };
      this._pathRouteComponents[routePath] = pathRouteComponent;
      routes[routePath] = {
        element: React.createElement(PageWrapper, { moduleFn: importFn }),
        path: routePath === '' ? '/' : routePath,
      };
      this._matchers[routePath] = match(routePath);
    }
    this._isBuilt = true;
    this._routes = routes;
    return Object.values(routes);
  }

  getRouteMatch(route: string) {
    for (const [routePath, matcher] of Object.entries(this._matchers)) {
      if (matcher(route)) {
        return routePath;
      }
    }
    return '/';
  }

  getPathComponentFor(
    routeMatch: string,
    pathRouteComponentType: PathRouteComponentType
  ) {
    const match = this._pathRouteComponents[routeMatch];
    if (match && match[pathRouteComponentType]) {
      return match[pathRouteComponentType];
    }
    return this._pathRouteComponents['/'][pathRouteComponentType]!;
  }

  private findNearestComponentType(
    relativeFilename: string,
    pathRouteComponentType: PathRouteComponentType
  ) {
    let currentDir = getParentDir(relativeFilename);
    const filenames = Object.keys(this._globImports);
    do {
      // since there should only be 1 match per dir, we only have to check once
      const match = filenames.find((filename) =>
        new RegExp(
          `^${currentDir}/${pathRouteComponentType}\\.(j|t)sx?$`,
          'i'
        ).test(filename)
      );
      if (match) {
        debug(`Match found for ${relativeFilename} at ${match}`);
        return this._globImports[match];
      }
    } while (currentDir !== (currentDir = getParentDir(relativeFilename)));
    return emptyComponentTypeImport;
  }
}
