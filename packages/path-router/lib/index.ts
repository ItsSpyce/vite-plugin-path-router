import {
  type Plugin,
  normalizePath,
  transformWithEsbuild,
  type ViteDevServer,
} from 'vite';
import * as path from 'path';
import * as fs from 'fs/promises';
import fg from 'fast-glob';
import _debug from 'debug';
import { buildPathList, buildPathTree, parseModuleId } from './utils';

const debug = _debug('vite-plugin-react-path-router');

export type PathRouterOpts = {
  include?: string[];
  exclude?: string[];
  transform?: RoutePathTransform | RoutePathTransformRecord;
};

export interface RoutePathTransform {
  (pathname: string): string;
}

export type RoutePathTransformRecord = {
  [pathname: string]: RoutePathTransform | RoutePathTransformRecord;
};

export type PathList = {
  [url: string]: string;
};

export type PathTreeNode = {
  [subroute: string]: PathTreeNode | string | undefined;
  '/'?: string;
};

const routesVirtualModule = 'virtual:path-routes';
const resolvedRoutesVirtualModule = '\0' + routesVirtualModule;

export default function pathRouter(opts?: PathRouterOpts): Plugin {
  debug('Setting up plugin');
  const pattern = opts?.include || ['**/pages/**/*.{j,t}sx'];
  const transform = opts?.transform;
  let pathList: PathList;
  let pageLocations: string[];
  let pathTree: PathTreeNode;
  let server: ViteDevServer;

  return {
    name: 'vite:path-router-plugin',
    async configureServer(_server) {
      server = _server;
      debug('Server configured');
    },
    async buildStart() {
      try {
        const pageLocations = await fg(pattern, {
          stats: false,
          ignore: opts?.exclude,
          absolute: true,
        });
        pathList = buildPathList(
          pageLocations.map((pathname) =>
            normalizePath(path.relative(server.config.root, pathname))
          ),
          transform
        );
        pathTree = buildPathTree(pathList);
        server.watcher.on('unlink', async (path) => {
          // TODO: remove from virtual module
        });
        server.watcher.add(pageLocations);
        debug(pageLocations);
      } catch (err) {
        if (err instanceof Error) {
          console.error(err.message);
        } else {
          console.error(`${err}`);
        }
      } finally {
        debug('Build started');
      }
    },
    async resolveId(id) {
      const { moduleId, pageId } = parseModuleId(id);
      if (moduleId === routesVirtualModule) {
        return resolvedRoutesVirtualModule;
      }
      if (moduleId === '/vite-plugin-react-path-router/pages' && pageId) {
        try {
          const absoluteFilename = normalizePath(
            path.join(server.config.root, pageId)
          );
          return absoluteFilename;
        } catch (err) {
          debug(`Failed to load page ${pageId}: ${err}`);
          return null;
        }
      }
    },
    async load(id) {
      const { moduleId, pageId } = parseModuleId(id);
      if (moduleId === resolvedRoutesVirtualModule) {
        debug(`Fetching dynamic module ${id}`);
        return `
          export const pathTree = ${JSON.stringify(pathTree || {})};
          export const pathList = ${JSON.stringify(pathList || {})};
          export const pageLocations = ${JSON.stringify(pageLocations || [])};
        `;
      }
      if (moduleId === '/vite-plugin-react-path-router/pages' && pageId) {
        try {
          const absoluteFilename = normalizePath(
            path.join(server.config.root, pageId)
          );
          const built = await transformWithEsbuild(
            await fs.readFile(absoluteFilename, 'utf-8'),
            absoluteFilename,
            { sourceRoot: server.config.root }
          );
          return built;
        } catch (err) {
          debug(`Failed to load page ${pageId}: ${err}`);
          return null;
        }
      }
    },
  };
}
