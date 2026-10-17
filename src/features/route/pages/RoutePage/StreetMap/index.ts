import { lazy } from 'react'

/** Loaded only when a route is shown: the map library is heavy. */
export const StreetMap = lazy(() => import('./StreetMap'))
