import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  useNavigate,
  useRoutes,
  useParams,
  useLocation,
  matchPath,
  createRoutesFromChildren,
  Routes,
  type RoutesProps,
  type Params,
  type RouteObject,
  type Location,
  type PathMatch,
} from 'react-router-dom';
import _debug from 'debug';
const debug = _debug('path-router');
//const debug = console.log;

/// Types

interface MatchFunction {
  (routePattern: string): PathMatch | null;
}

type RoutePatternEntry = {
  match: MatchFunction;
  components?: PathRouteComponents;
  route: RouteObject;
  filename: string;
  path: string;
};

type RoutePatternContainer = {
  [routePattern: string]: RoutePatternEntry;
};

type PathRouteComponentType = 'notFound' | 'notAuthorized' | 'error' | 'layout';

type PathRouteComponents = {
  [type in PathRouteComponentType]: React.ComponentType<
    React.PropsWithChildren<{}>
  >;
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

export interface GetAuthenticate<TSession = RouteSession> {
  (session: TSession):
    | Promise<boolean | string | void | undefined>
    | boolean
    | string
    | void
    | undefined;
}

export interface AuthorizationProvider {
  (): RouteSession;
}

export interface LayoutResultProps extends React.PropsWithChildren<{}> {}

export interface GetLayout {
  (props: LayoutResultProps): React.ReactElement;
}

export interface Page<TParams = Params> {
  (props: PageProps<TParams>): React.ReactElement;
}

/// Contexts

//@ts-ignore
export const FileRoutingContext = createContext<FileRoutingController>();
export const RoutePatternContext = createContext('/');
export const RouteSessionContext = createContext<RouteSession>({});

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
  const session = useRouteSession();
  const navigate = useNavigate();
  const Page = React.lazy(moduleFn);
  const params = useParams();
  const [mayRender, setMayRender] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(true);
  useEffect(() => {
    _loadModule();
  }, []);
  useEffect(() => {}, []);

  return (
    <RouteErrorBoundary>
      {mayRender && isAuthorized && (
        <React.Suspense>
          <Page params={params} />
        </React.Suspense>
      )}
      {mayRender && !isAuthorized && <NotAuthorized />}
    </RouteErrorBoundary>
  );

  async function _loadModule() {
    const mod = await moduleFn();
    const authenticate: GetAuthenticate = mod.authenticate;
    if (!authenticate) {
      setMayRender(true);
      return;
    }
    const authResult = await authenticate(session);
    if (typeof authResult === 'string') {
      // safely set just in case even though a navigate is occuring
      setIsAuthorized(false);
      navigate(authResult);
    } else if (authResult === true) {
      setMayRender(true);
    } else {
      // 'false' and 'undefined' are looked at as the same here
      setIsAuthorized(false);
      setMayRender(true);
    }
  }
}

export function NotFound() {
  return React.createElement(usePathComponent('notFound'));
}

export function NotAuthorized() {
  return React.createElement(usePathComponent('notAuthorized'));
}

export function Layout({ children }: React.PropsWithChildren<{}>) {
  return React.createElement(usePathComponent('layout'), {
    children,
  });
}

function LayoutContainer({ children }: React.PropsWithChildren<{}>) {
  const fileRoutingController = useContext(FileRoutingContext);
  const [routes, setRoutes] = useState<RouteObject[]>([]);
  const renderableRoutes = useRoutes(routes);

  useEffect(() => {
    fileRoutingController.buildRoutes().then((pathRoutes) => {
      setRoutes([...pathRoutes, ...createRoutesFromChildren(children)]);
    });
  }, [fileRoutingController]);

  return (
    <>{routes.length == 0 ? <></> : <Layout>{renderableRoutes}</Layout>}</>
  );
}

export interface PathRoutesProps<TSession> extends RoutesProps {
  pages: GlobImport;
  session: TSession;
}

export function PathRoutes<TSession extends RouteSession>({
  children,
  pages,
  location: _location,
  session,
}: PathRoutesProps<TSession>) {
  const location = useLocation();
  const [routePattern, setRoutePattern] = useState(
    typeof _location === 'string' ? _location : _location?.pathname || '/'
  );
  const [fileRoutingController] = useState(new FileRoutingController(pages));

  useEffect(() => {
    const newRoutePath = fileRoutingController.getMatchingRoutePattern(
      location.pathname
    );
    if (newRoutePath !== routePattern) {
      setRoutePattern(newRoutePath);
      debug(`Route path changed from ${routePattern} to ${newRoutePath}`);
    }
  }, [location.pathname]);

  return (
    <RouteErrorBoundary>
      <RoutePatternContext.Provider value={routePattern}>
        <FileRoutingContext.Provider value={fileRoutingController}>
          <LayoutContainer>{children}</LayoutContainer>
        </FileRoutingContext.Provider>
      </RoutePatternContext.Provider>
    </RouteErrorBoundary>
  );
}

/// Hooks

export function useRoutePattern() {
  return useContext(RoutePatternContext);
}

export function usePathComponent(pathComponentType: PathRouteComponentType) {
  const routePattern = useRoutePattern();
  const fileRoutingController = useContext(FileRoutingContext);
  return fileRoutingController.getPathComponentFor(
    routePattern,
    pathComponentType
  );
}

function useRouteSession() {
  return useContext(RouteSessionContext);
}

/// Utils

const EmptyComponent = () => <></>;

export function getRoutePatternFromPath(
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

function createMatch(routePattern: string): MatchFunction {
  const pattern = `${routePattern}`;
  return (route: string) => matchPath(pattern, route);
}

class FileRoutingController {
  private _routePatternContainer: RoutePatternContainer = {};
  private _isBuilt = false;

  constructor(private _globImports: GlobImport) {}

  async buildRoutes(): Promise<RouteObject[]> {
    if (!this._isBuilt) {
      for (const [path, moduleFn] of Object.entries(this._globImports)) {
        const routePattern = getRoutePatternFromPath(path);
        const filename = getFilename(path);

        if (
          reservedPaths.includes(filename as PathRouteComponentType) ||
          !!this._routePatternContainer[routePattern]
        ) {
          continue;
        }

        const layout = await this.findNearestComponentType(path, 'layout');
        const error = await this.findNearestComponentType(path, 'error');
        const notFound = await this.findNearestComponentType(path, 'notFound');
        const notAuthorized = await this.findNearestComponentType(
          path,
          'notAuthorized'
        );

        const components = {
          layout,
          error,
          notFound,
          notAuthorized,
        };
        const match = createMatch(routePattern);
        const route: RouteObject = {
          element: React.createElement(PageWrapper, { moduleFn }),
          path: routePattern === '' ? '/' : routePattern,
        };

        this._routePatternContainer[routePattern] = {
          path,
          filename,
          components,
          match,
          route,
        };
      }
      this._isBuilt = true;
    }
    return Object.values(this._routePatternContainer).map((rp) => rp.route);
  }

  getMatchingRoutePattern(route: string) {
    for (const [routePattern, { match }] of Object.entries(
      this._routePatternContainer
    )) {
      if (match(route)) {
        return routePattern;
      }
    }
    return '/';
  }

  getPathComponentFor(
    routePattern: string,
    pathRouteComponentType: PathRouteComponentType
  ) {
    const components = this._routePatternContainer[routePattern]?.components;
    if (components && components[pathRouteComponentType]) {
      return components[pathRouteComponentType];
    }
    return (
      this._routePatternContainer['/']?.components?.[pathRouteComponentType] ||
      EmptyComponent
    );
  }

  private async findNearestComponentType(
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
        return await resolveImport(this._globImports[match]);
      }
    } while (currentDir !== (currentDir = getParentDir(relativeFilename)));
    return EmptyComponent;
  }
}

async function resolveImport(importFn: DynamicImport) {
  return (await importFn()).default;
}
