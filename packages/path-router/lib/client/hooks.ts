import { useContext } from 'react';
import {
  useNavigate as _useNavigate,
  NavigateOptions as RrNavigateOptions,
  Params,
} from 'react-router-dom';
import { compile } from 'path-to-regexp';
import { type Page, PathHashMapContext } from './components';
import { getFunctionHash, queryToString } from './utils';

export interface NavigateOptions<TParams> extends RrNavigateOptions {
  params?: TParams;
  query?: Record<string, string | boolean | number>;
}

export interface UseNavigateHook<TParams> {
  (page: Page, opts?: NavigateOptions<TParams>): Promise<void>;
}

export function useNavigate<TParams = Params>(): UseNavigateHook<TParams> {
  const pathHashMapContext = useContext(PathHashMapContext);
  const rrNavigate = _useNavigate();
  const navigate = async (page: Page, opts?: NavigateOptions<TParams>) => {
    const params = opts?.params || {};
    const query = opts?.query || {};
    const hash = getFunctionHash(page);
    const targetUrl = (await pathHashMapContext)[hash];
    if (targetUrl) {
      const applyParams = compile(targetUrl, { encode: encodeURIComponent });
      const urlWithParams = applyParams(params);
      const urlWithParamsAndQuery = `/${urlWithParams}?${queryToString(query)}`;
      rrNavigate(urlWithParamsAndQuery, opts);
    } else {
      console.error(`${page.name} is not a valid or registered route`);
    }
  };

  return navigate;
}
