const CACHE_NAME = 'scad-cache-v1';

// Instalace a okamžitá aktivace workeru
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

// Vyčištění starých verzí mezipaměti při aktualizaci
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => {
        return Promise.all(keys.map(key => {
            if (key !== CACHE_NAME) return caches.delete(key);
        }));
    }));
});

// Zachytávání všech požadavků (Cache-First strategie)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(response => {
            // Pokud máme soubor v cache, vrátíme ho okamžitě (0 ms)
            if (response) return response;
            
            // Jinak ho stáhneme z internetu a rovnou uložíme do cache pro příště
            return fetch(e.request).then(fetchRes => {
                return caches.open(CACHE_NAME).then(cache => {
                    if (e.request.method === 'GET' && e.request.url.startsWith('http')) {
                        cache.put(e.request, fetchRes.clone());
                    }
                    return fetchRes;
                });
            });
        })
    );
});
