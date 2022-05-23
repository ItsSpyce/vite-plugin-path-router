import type { PathList } from './types';

export type PathHashMap = {
  [pageHash: number]: string;
};

/**
 * @author https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 *
 * @param fn The function to hash
 * @returns The hashed value of the function
 */
export function getFunctionHash(fn: Function) {
  const str = fn.name + fn.toString();
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0, ch: number; i < str.length; ++i) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export async function buildPathHashMap(
  pathList: PathList
): Promise<PathHashMap> {
  const map: PathHashMap = {};
  const pathListEntries = Object.entries(pathList);
  for (const [url, importUrl] of pathListEntries) {
    try {
      const page = await import(
        /*@vite-ignore */ `/vite-plugin-react-path-router/pages?id=${importUrl}`
      );
      if (typeof page.default !== 'function') {
        continue;
      }
      const pageHash = getFunctionHash(page.default);
      map[pageHash] = url;
    } catch (err) {
      console.error(err);
    }
  }
  return map;
}

export function queryToString(
  query: Record<string, string | number | boolean>
) {
  return Object.keys(query)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`
    )
    .join('&');
}
