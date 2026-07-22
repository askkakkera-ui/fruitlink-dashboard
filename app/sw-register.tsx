'use client'
import { useEffect } from 'react'

// Registers the PWA service worker and keeps it fresh across deploys, so a new
// release rolls out silently without anyone clearing caches:
//  - updateViaCache: 'none' — the sw.js script is never served from the HTTP
//    cache, so the browser always sees a bumped version on the update check.
//  - registration.update() on load — forces an immediate check for a new SW.
//  - controllerchange — when a new SW takes control (via skipWaiting +
//    clients.claim in sw.js), reload once so the page runs the fresh assets.
//    The very first install (no prior controller) is skipped — that's not an
//    update — and a guard prevents any reload loop.
export default function SwRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let refreshing = false
    const hadController = !!navigator.serviceWorker.controller
    const onControllerChange = () => {
      // Only reload when an EXISTING controller was replaced by a new SW (a real
      // update). On the first-ever install there was no controller, so skip.
      if (refreshing || !hadController) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => { reg.update().catch(() => {}) })
        .catch(() => {})
    }
    window.addEventListener('load', onLoad)
    return () => {
      window.removeEventListener('load', onLoad)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])
  return null
}
