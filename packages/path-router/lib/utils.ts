import type {
  PathList,
  PathTreeNode,
  RoutePathTransform,
  RoutePathTransformRecord,
} from '.';

export const getDynamicPathParts = (name: string) => [
  ...name.matchAll(/\[([A-Za-z_-]+)\]/g),
];

export type CasingOpts = {
  separator?: string | false;
};

export const normalizeCasing = (value: string, opts?: CasingOpts) => {
  const separator = opts?.separator === false ? '' : opts?.separator || '-';
  return value.replaceAll(
    /([a-z])([A-Z])([a-z])/g,
    (_, p1, p2, p3) => `${p1}${separator}${p2.toLowerCase()}${p3}`
  );
};

export const formatFilenameToPathname = (filename: string) =>
  filename
    .replaceAll(/\[([A-Za-z_-]+)\]/g, ':$1')
    .replaceAll(/(\.(?:j|t)sx?)/g, '');

export const applyPathnameTransformation = (
  transforms: RoutePathTransformRecord,
  pathname: string
) => {
  let transformed = pathname;
  if (typeof transforms['*'] === 'function') {
    transformed = transforms['*'](transformed);
  }
  // TODO: apply more transforms
  return transformed;
};

export const buildPathList = (
  included: string[],
  transform?: RoutePathTransform | RoutePathTransformRecord
) => {
  const pathTree: PathList = {};

  for (const filename of included) {
    const [_, route] = filename.split('/pages/');
    if (!route) {
      continue;
    }
    const normalizedRoute = normalizeCasing(formatFilenameToPathname(route));
    if (!transform) {
      pathTree[normalizedRoute] = filename;
    } else {
      const transformed = applyPathnameTransformation(
        typeof transform === 'function' ? { '*': transform } : transform,
        normalizedRoute
      );
      pathTree[transformed] = filename;
    }
  }

  return pathTree;
};

export const buildPathTree = (pathList: PathList) => {
  const pathTree: PathTreeNode = {};
  const pathListKeys = Object.keys(pathList);
  const pathListEntries = Object.entries(pathList);

  for (const [pathname, filename] of pathListEntries) {
    const [root] = pathname.split('/');
    if (root === 'index') {
      pathTree['/'] = filename;
      continue;
    }

    if (typeof pathTree[root] !== 'undefined') {
      continue;
    }

    const ownedSubroutes = pathListKeys.filter((subroutePathname) =>
      subroutePathname.startsWith(`${root}/`)
    );
    if (ownedSubroutes.length > 0) {
      const subroutePathList: PathList = ownedSubroutes.reduce(
        (acc, subroutePathname) => ({
          ...acc,
          [subroutePathname.substring(subroutePathname.indexOf('/') + 1)]:
            pathList[subroutePathname],
        }),
        {}
      );
      const subroutePathTree = buildPathTree(subroutePathList);
      pathTree[root] = subroutePathTree;
    } else {
      pathTree[root] = filename;
    }
  }

  return pathTree;
};

export function parseModuleId(id: string) {
  const [moduleId, rawQuery] = id.split('?', 2);
  const query = new URLSearchParams(rawQuery);
  const pageId = query.get('id');
  return {
    moduleId,
    query,
    pageId,
  };
}
