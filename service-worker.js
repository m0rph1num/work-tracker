// service-worker.js
const APP_PREFIX = 'work_tracker_';
const VERSION = 'v1.0';
const CACHE_NAME = APP_PREFIX + VERSION;

// Динамически определяем базовый путь
const getBasePath = () => {
  const path = self.location.pathname;
  // Если мы в корне репозитория GitHub Pages
  if (path.includes('/work-tracker/')) {
    return '/work-tracker/';
  }
  // Если развернуто в корне
  return '/';
};

const BASE_PATH = getBasePath();

// Файлы для кэширования
const CORE_FILES = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'style.css',
  BASE_PATH + 'app.js',
  BASE_PATH + 'manifest.json'
];

// Внешние ресурсы
const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

console.log('Service Worker запущен в:', BASE_PATH);
console.log('Кэшируемые файлы:', CORE_FILES);

// Установка и кэширование
self.addEventListener('install', (event) => {
  console.log('Установка Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Открыт кэш:', CACHE_NAME);
        // Сначала кэшируем основные файлы
        return cache.addAll(CORE_FILES)
          .then(() => {
            console.log('Основные файлы закэшированы');
            // Затем внешние ресурсы
            return cache.addAll(EXTERNAL_RESOURCES);
          })
          .then(() => {
            console.log('Все ресурсы закэшированы');
          });
      })
      .catch((error) => {
        console.error('Ошибка кэширования:', error);
      })
  );
  
  // Немедленная активация
  self.skipWaiting();
});

// Активация
self.addEventListener('activate', (event) => {
  console.log('Активация Service Worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем старые версии кэша
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Активация завершена');
      // Берем контроль над всеми клиентами
      return self.clients.claim();
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') {
    return;
  }

  // Игнорируем chrome-extension запросы
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Если есть в кэше, возвращаем
        if (cachedResponse) {
          console.log('Из кэша:', event.request.url);
          return cachedResponse;
        }

        // Иначе загружаем из сети
        console.log('Из сети:', event.request.url);
        return fetch(event.request)
          .then((networkResponse) => {
            // Проверяем валидность ответа
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Клонируем ответ для кэширования
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('Добавлено в кэш:', event.request.url);
              })
              .catch((error) => {
                console.error('Ошибка добавления в кэш:', error);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.log('Ошибка сети для:', event.request.url);
            
            // Для навигационных запросов возвращаем запасную страницу
            if (event.request.mode === 'navigate') {
              return caches.match(BASE_PATH + 'index.html');
            }
            
            // Можно вернуть кастомный офлайн-контент
            return new Response('Офлайн', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// Сообщения от клиентов
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
