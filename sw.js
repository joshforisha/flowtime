const version = '3'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(version).then(cache =>
      cache.addAll([
        './',
        './chime.wav',
        './icon-192.png',
        './icon-32.png',
        './icon-512.png',
        './index.html',
        './manifest.json'
      ])
    )
  )

  event.waitUntil(
    caches.keys().then(keyList =>
      Promise.all(keyList.map(key => {
        if (key !== version) return caches.delete(key)
      }))
    )
  )
})

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        if (res.status > 299) {
          caches.open(version).then(cache => {
            cache.put(event.request, res.clone())
            return res
          })
        } else return res
      })
    )
  )
})
