import { pathToRegexp } from 'next/dist/compiled/path-to-regexp'
import type {
  ManifestHeaderRoute,
  ManifestRedirectRoute,
  ManifestRewriteRoute,
} from '../build'
import {
  normalizeRouteRegex,
  type Header,
  type Redirect,
  type Rewrite,
  type RouteType,
} from './load-custom-routes'
import { getRedirectStatus, modifyRouteRegex } from './redirect-status'
import { RSC_REDIRECT_STATUS_CODE } from '../shared/lib/constants'
import { RSC_HEADER } from '../client/components/app-router-headers'

export function buildCustomRoute(
  type: 'header',
  route: Header
): ManifestHeaderRoute
export function buildCustomRoute(
  type: 'rewrite',
  route: Rewrite
): ManifestRewriteRoute
export function buildCustomRoute(
  type: 'redirect',
  route: Redirect,
  restrictedRedirectPaths: string[]
): ManifestRedirectRoute
export function buildCustomRoute(
  type: RouteType,
  route: Redirect | Rewrite | Header,
  restrictedRedirectPaths?: string[]
): ManifestHeaderRoute | ManifestRewriteRoute | ManifestRedirectRoute {
  const compiled = pathToRegexp(route.source, [], {
    strict: true,
    sensitive: false,
    delimiter: '/', // default is `/#?`, but Next does not pass query info
  })

  let source = compiled.source
  if (!route.internal) {
    source = modifyRouteRegex(
      source,
      type === 'redirect' ? restrictedRedirectPaths : undefined
    )
  }

  const regex = normalizeRouteRegex(source)

  if (type !== 'redirect') {
    return { ...route, regex }
  }

  return {
    ...route,
    statusCode: getRedirectStatus(route as Redirect),
    permanent: undefined,
    regex,
  }
}

/**
 * Converts a standard redirect route to an RSC redirect route.
 *
 * RSC redirects use a custom status code (278) instead of standard HTTP redirect codes
 * to prevent browsers from automatically following the redirect. This allows the client-side
 * RSC router to intercept and handle the redirect programmatically, providing better control
 * over the navigation lifecycle.
 *
 * The function adds a header condition to only apply this redirect for RSC requests
 * (identified by the presence of the RSC header) and sets the custom status code.
 */
export function toRscRedirect<T extends ManifestRedirectRoute>(
  customRoute: T
): T {
  return {
    ...customRoute,
    statusCode: RSC_REDIRECT_STATUS_CODE,
    permanent: undefined,
    has: [
      ...(customRoute.has || []),
      {
        type: 'header',
        key: RSC_HEADER,
      },
    ],
  } as const
}
