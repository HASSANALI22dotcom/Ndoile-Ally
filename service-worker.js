// Service Worker for Ukoo wa ALLY NDOILE MKILINDI PWA
// Version 1.0.0

const CACHE_NAME = 'ukoo-ally-v1.0.0';
const STATIC_CACHE_NAME = 'ukoo-ally-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'ukoo-ally-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/favicon.ico',
  // Add any CSS files if they're separate
  // Add any JS files if they're separate
];

// Dynamic content patterns to cache
const CACHEABLE_PATHS = [
  /^\/api\//,
  /\.(jpg|jpeg|png|gif|svg|webp)$/i,
  /\.(woff|woff2|ttf|eot)$/i,
];

// Maximum age for cached content (in milliseconds)
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker: Static assets cached successfully');
        // Force the waiting service worker to become the active service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old versions of our caches
              return (
                cacheName.startsWith('ukoo-ally-') &&
                cacheName !== STATIC_CACHE_NAME &&
                cacheName !== DYNAMIC_CACHE_NAME
              );
            })
            .map((cacheName) => {
              console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Cache cleanup completed');
        // Take control of all clients immediately
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Cache cleanup failed:', error);
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (isStaticAsset(request)) {
    // Cache First strategy for static assets
    event.respondWith(cacheFirst(request));
  } else if (isApiRequest(request)) {
    // Network First strategy for API requests
    event.respondWith(networkFirst(request));
  } else if (isDynamicContent(request)) {
    // Stale While Revalidate for dynamic content
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Default: Cache First with network fallback
    event.respondWith(cacheFirst(request));
  }
});

// Cache First Strategy - good for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📋 Service Worker: Serving from cache:', request.url);
      return cachedResponse;
    }
    
    console.log('🌐 Service Worker: Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    // Cache the response for future use
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Service Worker: Cache First failed:', error);
    return getOfflineFallback(request);
  }
}

// Network First Strategy - good for API requests
async function networkFirst(request) {
  try {
    console.log('🌐 Service Worker: Network First for:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cacheResponse(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📋 Service Worker: Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    console.error('❌ Service Worker: Network First failed:', error);
    return getOfflineFallback(request);
  }
}

// Stale While Revalidate Strategy - good for dynamic content
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  // Always fetch in the background
  const networkResponsePromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        await cacheResponse(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('❌ Service Worker: Background fetch failed:', error);
    });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    console.log('📋 Service Worker: Serving stale content:', request.url);
    return cachedResponse;
  }
  
  // If no cache, wait for network
  console.log('🌐 Service Worker: No cache, waiting for network:', request.url);
  return networkResponsePromise;
}

// Cache response helper
async function cacheResponse(request, response) {
  try {
    const cache = await caches.open(getDynamicCacheName(request));
    await cache.put(request, response);
    console.log('💾 Service Worker: Cached response for:', request.url);
  } catch (error) {
    console.error('❌ Service Worker: Failed to cache response:', error);
  }
}

// Helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => url.pathname === asset) ||
         /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(url.pathname);
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || 
         url.hostname !== self.location.hostname;
}

function isDynamicContent(request) {
  return CACHEABLE_PATHS.some(pattern => pattern.test(request.url));
}

function getDynamicCacheName(request) {
  if (isApiRequest(request)) {
    return `${DYNAMIC_CACHE_NAME}-api`;
  }
  return DYNAMIC_CACHE_NAME;
}

function getOfflineFallback(request) {
  // Return appropriate offline fallback
  if (request.destination === 'document') {
    return caches.match('/index.html') || new Response(
      `<!DOCTYPE html>
      <html lang="sw">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hukuna Intaneti - Ukoo wa ALLY NDOILE MKILINDI</title>
        <style>
          body { 
            font-family: Georgia, serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #166534, #1e40af);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
          }
          .offline-container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
          }
          h1 { font-size: 2.5em; margin-bottom: 20px; }
          p { font-size: 1.2em; margin-bottom: 20px; }
          button { 
            background: #d4af37; 
            color: #166534; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 10px; 
            font-size: 16px; 
            font-weight: bold;
            cursor: pointer;
          }
          .emoji { font-size: 4em; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="emoji">📶❌</div>
          <h1>Hukuna Intaneti</h1>
          <p>Samahani, hukuna muunganisho wa intaneti kwa sasa.</p>
          <p>Jaribu tena baada ya kurudi kwenye mtandao.</p>
          <button onclick="window.location.reload()">🔄 Jaribu Tena</button>
        </div>
      </body>
      </html>`,
      { 
        status: 200, 
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
  
  if (request.destination === 'image') {
    // Return a simple SVG placeholder for images
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f3f4f6"/>
        <text x="200" y="150" font-family="Arial" font-size="16" text-anchor="middle" fill="#6b7280">
          📷 Picha Haipatikani
        </text>
      </svg>`,
      { 
        status: 200, 
        statusText: 'OK',
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
  
  // Default offline response
  return new Response(
    JSON.stringify({ 
      error: 'Hukuna intaneti', 
      message: 'Huduma hii haipo wakati huu' 
    }),
    { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'send-message':
      event.waitUntil(syncMessages());
      break;
    case 'upload-photo':
      event.waitUntil(syncPhotos());
      break;
    case 'update-member':
      event.waitUntil(syncMemberUpdates());
      break;
    default:
      console.log('🤷 Service Worker: Unknown sync tag:', event.tag);
  }
});

// Sync functions for background sync
async function syncMessages() {
  try {
    // Get pending messages from IndexedDB or localStorage
    const pendingMessages = getPendingMessages();
    
    for (const message of pendingMessages) {
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
        
        // Remove from pending list after successful send
        removePendingMessage(message.id);
        console.log('✅ Service Worker: Message synced successfully');
      } catch (error) {
        console.error('❌ Service Worker: Failed to sync message:', error);
      }
    }
  } catch (error) {
    console.error('❌ Service Worker: Message sync failed:', error);
  }
}

async function syncPhotos() {
  try {
    console.log('📸 Service Worker: Syncing photos...');
    // Implementation for photo sync would go here
  } catch (error) {
    console.error('❌ Service Worker: Photo sync failed:', error);
  }
}

async function syncMemberUpdates() {
  try {
    console.log('👥 Service Worker: Syncing member updates...');
    // Implementation for member update sync would go here
  } catch (error) {
    console.error('❌ Service Worker: Member sync failed:', error);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('📨 Service Worker: Push notification received');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data = { title: 'Ujumbe Mpya', body: event.data.text() };
    }
  }
  
  const options = {
    title: data.title || 'Ukoo wa ALLY NDOILE MKILINDI',
    body: data.body || 'Una ujumbe mpya kutoka kwa ukoo',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    data: data,
    actions: [
      {
        action: 'view',
        title: '👁️ Angalia',
        icon: '/android-chrome-192x192.png'
      },
      {
        action: 'close',
        title: '✖️ Funga'
      }
    ],
    tag: 'ukoo-notification',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
      .then(() => {
        console.log('✅ Service Worker: Notification displayed');
      })
      .catch((error) => {
        console.error('❌ Service Worker: Failed to show notification:', error);
      })
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'view') {
    // Open the app to relevant section
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Helper functions for pending operations (would need IndexedDB implementation)
function getPendingMessages() {
  // This would retrieve from IndexedDB or localStorage
  return [];
}

function removePendingMessage(messageId) {
  // This would remove from IndexedDB or localStorage
  console.log('Removing pending message:', messageId);
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('⏰ Service Worker: Periodic sync triggered:', event.tag);
  
  if (event.tag === 'update-content') {
    event.waitUntil(updateContent());
  }
});

async function updateContent() {
  try {
    // Update content periodically
    console.log('🔄 Service Worker: Updating content...');
  } catch (error) {
    console.error('❌ Service Worker: Content update failed:', error);
  }
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker: Error occurred:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker: Unhandled promise rejection:', event.reason);
});

console.log('🎉 Service Worker: Loaded successfully for Ukoo wa ALLY NDOILE MKILINDI');