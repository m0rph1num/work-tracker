class WorkTrackerApp {
  constructor() {
    this.currentMonth = 0;
    this.currentYear = 2026;
    this.currentDay = null;
    this.editingPositionId = null;
    this.editingCoefficientMonth = null;
    this.isLoading = false;
    this.selectedDay = null;
    this.eventListenersSet = false;

    // Инициализация обработчиков online/offline
    this.setupOnlineOfflineHandlers();

    // Инициализация приложения
    this.init();
  }

  setupOnlineOfflineHandlers() {
    window.addEventListener("online", () => {
      this.showToast("Соединение восстановлено", "Вы снова онлайн", "success");
    });

    window.addEventListener("offline", () => {
      this.showToast(
        "Нет соединения",
        "Приложение работает в офлайн-режиме",
        "warning"
      );
    });
  }

  setupOfflineFallback() {
    // Этот метод теперь только для браузеров без поддержки Service Worker
    if (!("serviceWorker" in navigator) && "caches" in window) {
      console.log("Используем fallback кэширование");
      const cacheName = "work-tracker-fallback";
      const urlsToCache = [
        "/work-tracker/",
        "/work-tracker/index.html",
        "/work-tracker/style.css",
        "/work-tracker/app.js",
      ];

      caches
        .open(cacheName)
        .then((cache) => {
          return cache.addAll(urlsToCache);
        })
        .catch((error) => {
          console.log("Fallback кэширование не удалось:", error);
        });
    }
  }

  init() {
    // Скрываем загрузчик с анимацией
    setTimeout(() => {
      const loader = document.getElementById("loader");
      if (loader) {
        loader.style.opacity = "0";
        loader.style.transform = "scale(0.95)";

        setTimeout(() => {
          loader.style.display = "none";
          this.setupApp();
        }, 300);
      } else {
        // Если лоадер не найден, запускаем приложение сразу
        this.setupApp();
      }
    }, 1000);
  }

  setupApp() {
    // Загрузка данных
    this.loadData();

    // Настройка темы
    this.setupTheme();

    // Настройка обработчиков
    this.setupEventListeners();

    // Показ первого месяца
    this.showCalendar();

    // Приветственное сообщение
    setTimeout(() => {
      this.showToast(
        "Готов к работе!",
        "Выберите день для ввода данных",
        "info"
      );
    }, 500);
  }

  loadData() {
    if (!localStorage.getItem("workTrackerData")) {
      this.data = this.getInitialData();
      this.saveData();
    } else {
      try {
        this.data = JSON.parse(localStorage.getItem("workTrackerData"));
      } catch (e) {
        console.error("Ошибка загрузки данных:", e);
        this.data = this.getInitialData();
        this.saveData();
      }
    }
  }

  getInitialData() {
    return {
      positions: [
        { id: 1, name: "Кладка кирпича", price: 1500 },
        { id: 2, name: "Штукатурка стен", price: 800 },
        { id: 3, name: "Покраска", price: 500 },
        { id: 4, name: "Укладка плитки", price: 1200 },
        { id: 5, name: "Монтаж гипсокартона", price: 600 },
      ],
      months: {},
      settings: {
        personCount: 4,
        defaultCoefficient: 0.15,
        theme: "light",
      },
      coefficients: {
        "2026-01": 0.15,
        "2026-02": 0.12,
        "2026-03": 0.15,
        "2026-04": 0.13,
        "2026-05": 0.15,
        "2026-06": 0.16,
        "2026-07": 0.14,
        "2026-08": 0.15,
        "2026-09": 0.13,
        "2026-10": 0.15,
        "2026-11": 0.14,
        "2026-12": 0.18,
      },
    };
  }

  saveData() {
    try {
      localStorage.setItem("workTrackerData", JSON.stringify(this.data));

      // Если поддерживается, сохраняем в IndexedDB для надежности
      if ("indexedDB" in window) {
        this.saveToIndexedDB();
      }
    } catch (e) {
      console.error("Ошибка сохранения:", e);
      this.showToast("Ошибка", "Не удалось сохранить данные", "error");

      // Пробуем сохранить в sessionStorage как fallback
      try {
        sessionStorage.setItem(
          "workTrackerData_backup",
          JSON.stringify(this.data)
        );
      } catch (e2) {
        console.error("Резервное сохранение тоже не удалось:", e2);
      }
    }
  }

  // ДОБАВИТЬ метод для IndexedDB (опционально, но рекомендуется):
  saveToIndexedDB() {
    if (!window.indexedDB) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open("WorkTrackerDB", 3); // Увеличиваем версию до 3

      request.onerror = (event) => {
        console.error("IndexedDB ошибка:", event.target.error);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Удаляем старую структуру и создаем новую
        if (db.objectStoreNames.contains("data")) {
          db.deleteObjectStore("data");
        }
        db.createObjectStore("data", { keyPath: "id" });
      };

      request.onsuccess = (event) => {
        const db = event.target.result;

        // Закрываем старую базу если была открыта с другой версией
        db.close();

        // Открываем заново с новой версией
        const newRequest = indexedDB.open("WorkTrackerDB", 3);

        newRequest.onsuccess = (e) => {
          const newDb = e.target.result;
          const transaction = newDb.transaction(["data"], "readwrite");
          const store = transaction.objectStore("data");

          const putRequest = store.put({
            id: "main",
            data: this.data,
            timestamp: new Date().toISOString(),
          });

          putRequest.onsuccess = () => {
            console.log("Данные сохранены в IndexedDB");
            newDb.close();
            resolve();
          };

          putRequest.onerror = (e) => {
            console.error("Ошибка сохранения в IndexedDB:", e.target.error);
            newDb.close();
            reject(e.target.error);
          };
        };

        newRequest.onerror = (e) => {
          console.error("Ошибка открытия новой версии:", e.target.error);
          reject(e.target.error);
        };
      };
    });
  }

  setupTheme() {
    const theme = this.data.settings.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);

    // Активируем соответствующую кнопку темы
    document.querySelectorAll(".theme-option").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.dataset.theme === theme) {
        btn.classList.add("active");
      }
    });
  }

  setupEventListeners() {
    // Если обработчики уже установлены, выходим
    if (this.eventListenersSet) {
      return;
    }

    console.log("Настраиваем обработчики событий...");

    // Навигация по месяцам - простые обработчики
    document.getElementById("prevMonthBtn").onclick = () =>
      this.changeMonth(-1);
    document.getElementById("nextMonthBtn").onclick = () => this.changeMonth(1);
    document.getElementById("todayBtn").onclick = () => this.goToToday();
    document.getElementById("monthSelect").onchange = (e) => {
      this.currentMonth = parseInt(e.target.value);
      this.showCalendar();
    };

    // Нижняя навигация
    document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
      item.onclick = (e) => {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        this.showSection(section);
      };
    });

    // Быстрое добавление - ФИКСИРОВАННАЯ ВЕРСИЯ
    const quickAddBtn = document.getElementById("quickAddBtn");
    if (quickAddBtn) {
      // Удаляем старый обработчик
      quickAddBtn.onclick = null;

      // Добавляем новый
      quickAddBtn.addEventListener("click", () => {
        console.log("QuickAdd clicked, selectedDay:", this.selectedDay);

        // Пробуем использовать selectedDay, если он есть
        let dayToUse = this.selectedDay;

        // Если нет selectedDay, попробуем найти выбранный день в DOM
        if (!dayToUse) {
          const selectedDayElement = document.querySelector(
            ".calendar-day.selected"
          );
          if (selectedDayElement) {
            dayToUse = parseInt(selectedDayElement.dataset.day);
            this.selectedDay = dayToUse;
            this.currentDay = dayToUse;
          }
        }

        if (dayToUse) {
          console.log("Opening day form for day:", dayToUse);
          this.openDayForm(dayToUse);
        } else {
          this.showToast(
            "Выберите день",
            "Сначала выберите день в календаре, нажав на него",
            "info"
          );
        }
      });
    }

    // Альтернативный способ: привязываем день к самой кнопке
    document.addEventListener("click", (e) => {
      if (e.target.closest(".calendar-day:not(.empty)")) {
        const dayElement = e.target.closest(".calendar-day:not(.empty)");
        const dayNumber = parseInt(dayElement.dataset.day);
        const quickAddBtn = document.getElementById("quickAddBtn");

        // Сохраняем день в data-атрибуте кнопки
        quickAddBtn.dataset.selectedDay = dayNumber;
        console.log("Day saved to button:", dayNumber);
      }
    });

    // Обновляем обработчик quickAddBtn с учетом data-атрибута
    const updateQuickAddHandler = () => {
      const quickAddBtn = document.getElementById("quickAddBtn");
      if (!quickAddBtn) return;

      quickAddBtn.onclick = () => {
        // Пробуем получить день из нескольких источников
        let dayToUse = null;

        // 1. Из data-атрибута кнопки
        if (quickAddBtn.dataset.selectedDay) {
          dayToUse = parseInt(quickAddBtn.dataset.selectedDay);
        }

        // 2. Из this.selectedDay
        if (!dayToUse && this.selectedDay) {
          dayToUse = this.selectedDay;
        }

        // 3. Из выделенного элемента в DOM
        if (!dayToUse) {
          const selectedDayElement = document.querySelector(
            ".calendar-day.selected"
          );
          if (selectedDayElement) {
            dayToUse = parseInt(selectedDayElement.dataset.day);
          }
        }

        if (dayToUse) {
          console.log("Opening form for day (from button):", dayToUse);
          this.selectedDay = dayToUse;
          this.currentDay = dayToUse;
          this.openDayForm(dayToUse);
        } else {
          this.showToast(
            "Выберите день",
            "Нажмите на любой день в календаре, затем на эту кнопку",
            "info"
          );
        }
      };
    };

    // Вызываем обновление обработчика
    updateQuickAddHandler();

    // Форма дня
    document.getElementById("backBtn").onclick = () => this.showCalendar();
    document.getElementById("clearDayBtn").onclick = () => this.clearDay();
    document.getElementById("saveDayBtn").onclick = () => this.saveDay();
    document.getElementById("addEntryBtn").onclick = () => this.addEntry();

    // Назад из других секций
    document.getElementById("backFromPositionsBtn").onclick = () =>
      this.showCalendar();
    document.getElementById("backFromSettingsBtn").onclick = () =>
      this.showCalendar();
    document.getElementById("backFromCoefficientsBtn").onclick = () =>
      this.showCalendar();

    // Позиции
    document.getElementById("addPositionBtn").onclick = () =>
      this.openPositionModal();

    // Настройки
    document.querySelectorAll(".theme-option").forEach((btn) => {
      btn.onclick = (e) => {
        const theme = e.currentTarget.dataset.theme;
        this.changeTheme(theme);
      };
    });

    document.getElementById("exportDataBtn").onclick = () => this.exportData();
    document.getElementById("importDataBtn").onclick = () => {
      document.getElementById("fileImport").click();
    };
    document.getElementById("resetDataBtn").onclick = () => this.resetData();
    // Обработчики для новых кнопок в настройках
    const openPositionsBtn = document.getElementById("openPositionsBtn");
    if (openPositionsBtn) {
      openPositionsBtn.onclick = () => {
        this.showSection("positions");
      };
    }

    const openCoefficientsBtn = document.getElementById("openCoefficientsBtn");
    if (openCoefficientsBtn) {
      openCoefficientsBtn.onclick = () => {
        this.showSection("coefficients");
      };
    }
    document.getElementById("fileImport").onchange = (e) => this.importData(e);

    // Модальные окна
    document.getElementById("closePositionModal").onclick = () =>
      this.closeModal("positionModal");
    document.getElementById("cancelPositionBtn").onclick = () =>
      this.closeModal("positionModal");
    document.getElementById("savePositionBtn").onclick = () =>
      this.savePosition();

    document.getElementById("closeCoefficientModal").onclick = () =>
      this.closeModal("coefficientModal");
    document.getElementById("cancelCoefficientBtn").onclick = () =>
      this.closeModal("coefficientModal");
    document.getElementById("saveCoefficientBtn").onclick = () =>
      this.saveCoefficient();

    document.getElementById("confirmCancelBtn").onclick = () =>
      this.closeModal("confirmModal");
    document.getElementById("confirmOkBtn").onclick = () =>
      this.executeConfirmedAction();

    // Закрытие модалок по клику на оверлей
    document.getElementById("modalOverlay").onclick = (e) => {
      if (e.target === e.currentTarget) {
        this.closeAllModals();
      }
    };

    // Закрытие по Escape - используем addEventListener, но с флагом once
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        this.closeAllModals();
      }
    };
    document.removeEventListener("keydown", escapeHandler);
    document.addEventListener("keydown", escapeHandler);

    // Ключевое исправление: Делегирование событий для динамических элементов
    this.setupDelegatedEventListeners();

    // Устанавливаем флаг
    this.eventListenersSet = true;
    console.log("Обработчики событий настроены");

    // Глобальный обработчик для отладки кликов по календарю
    // document.addEventListener("click", (e) => {
    //   if (e.target.closest(".calendar-day:not(.empty)")) {
    //     console.log("Calendar day clicked via global handler");
    //   }
    // });

    // Добавляем обработчики свайпа
    this.setupSwipeHandlers();
  }

  // Метод для свайпа:
  setupSwipeHandlers() {
    const calendarGrid = document.getElementById("calendarGrid");
    if (!calendarGrid) return;

    calendarGrid.addEventListener(
      "touchstart",
      (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );

    calendarGrid.addEventListener(
      "touchend",
      (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe();
      },
      { passive: true }
    );

    // Для десктопа - поддержка мыши
    let mouseStartX = 0;
    let mouseEndX = 0;

    calendarGrid.addEventListener("mousedown", (e) => {
      mouseStartX = e.clientX;
    });

    calendarGrid.addEventListener("mouseup", (e) => {
      mouseEndX = e.clientX;
      const diff = mouseEndX - mouseStartX;

      if (Math.abs(diff) > this.swipeThreshold) {
        if (diff > 0) {
          this.changeMonth(-1); // Свайп вправо - предыдущий месяц
        } else {
          this.changeMonth(1); // Свайп влево - следующий месяц
        }
      }
    });
  }

  handleSwipe() {
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > this.swipeThreshold) {
      if (diff > 0) {
        this.changeMonth(1); // Свайп влево - следующий месяц
        this.showToast("Месяц", "Следующий месяц", "info");
      } else {
        this.changeMonth(-1); // Свайп вправо - предыдущий месяц
        this.showToast("Месяц", "Предыдущий месяц", "info");
      }
    }
  }

  // Метод для обновления сводки месяца:
  updateMonthSummary() {
    const monthKey = this.getMonthKey();
    const monthData = this.data.months[monthKey] || { days: {} };
    const days = monthData.days;

    // Считаем статистику
    const workingDays = Object.keys(days).length;
    const monthTotal = monthData.calculated?.total || 0;

    // Обновляем заголовок
    document.getElementById(
      "workingDaysCount"
    ).textContent = `${workingDays} рабочих ${this.getDayWord(workingDays)}`;
    document.getElementById(
      "monthTotal"
    ).textContent = `${monthTotal.toLocaleString()} ₽`;

    // Обновляем список дней
    this.updateDaysList(days);
  }

  // Вспомогательный метод для склонения "день/дня/дней":
  getDayWord(count) {
    if (count % 10 === 1 && count % 100 !== 11) return "день";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100))
      return "дня";
    return "дней";
  }

  // Метод для обновления списка дней:
  updateDaysList(days) {
    const container = document.getElementById("daysList");
    if (!container) return;

    if (Object.keys(days).length === 0) {
      container.innerHTML = `
      <div class="empty-summary">
        <i class="fas fa-calendar-times"></i>
        <p>Нет данных за этот месяц</p>
      </div>
    `;
      return;
    }

    const sortedDays = Object.entries(days).sort((a, b) => {
      const dayA = parseInt(a[0].split("-")[2]);
      const dayB = parseInt(b[0].split("-")[2]);
      return dayA - dayB;
    });

    let html = "";

    sortedDays.forEach(([dayKey, dayData]) => {
      const day = parseInt(dayKey.split("-")[2]);
      const month = parseInt(dayKey.split("-")[1]);
      const year = parseInt(dayKey.split("-")[0]);

      const date = new Date(year, month - 1, day);

      const dayFormatted = String(day).padStart(2, "0");
      const monthFormatted = String(month).padStart(2, "0");
      const weekdayShort = date.toLocaleDateString("ru-RU", {
        weekday: "short",
      });

      const fullDate = `${dayFormatted}.${monthFormatted}.${year} ${weekdayShort}`;

      // Форматируем время
      let totalHours = dayData.totalHours || 0;
      if (!totalHours && dayData.timeStart && dayData.timeEnd) {
        totalHours = this.calculateWorkHours(
          dayData.timeStart,
          dayData.timeEnd
        );
      }

      const formattedHours = this.formatWorkHours(totalHours);

      let detailsHTML = "";
      if (dayData.entries && dayData.entries.length > 0) {
        dayData.entries.forEach((entry) => {
          detailsHTML += `
          <div class="position-item">
            <div class="position-item-info">
              <span>${entry.positionName}</span>
            </div>
            <div class="position-item-quantity">
              <span>${entry.quantity} × ${entry.price.toLocaleString()} ₽</span>
            </div>
          </div>
        `;
        });
      }

      html += `
<div class="day-summary-item" data-day="${day}">
  <div class="day-summary-header">
    <div class="day-summary-date">
      ${fullDate}
    </div>
    <div class="day-summary-total">
      <span class="day-summary-hours">${formattedHours}</span>
      <span class="day-summary-amount">${dayData.dailyTotal.toLocaleString()} ₽</span>
    </div>
  </div>
  ${detailsHTML ? `<div class="day-summary-details">${detailsHTML}</div>` : ""}
</div>
`;
    });

    container.innerHTML = html;

    // Добавляем обработчики кликов на дни в сводке
    container.querySelectorAll(".day-summary-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const day = parseInt(item.dataset.day);
        this.selectedDay = day;
        this.currentDay = day;
        this.openDayForm(day);
      });
    });
  }

  setupDelegatedEventListeners() {
    // Удаляем старые обработчики если были
    document.removeEventListener("click", this.handleDocumentClick);

    // Создаем новый обработчик
    this.handleDocumentClick = (e) => {
      // Обработка кликов на коэффициенты
      const coefficientItem = e.target.closest(".coefficient-item");
      if (coefficientItem) {
        e.preventDefault();
        e.stopImmediatePropagation();

        const container = coefficientItem.closest(".coefficients-list");
        if (container) {
          const items = Array.from(container.children);
          const index = items.indexOf(coefficientItem);
          if (index !== -1) {
            this.openCoefficientModal(index);
          }
        }
        return;
      }

      // Обработка кликов на кнопки позиций
      const positionsContainer = document.getElementById("positionsList");
      if (positionsContainer && positionsContainer.contains(e.target)) {
        const editBtn = e.target.closest(".edit-btn");
        const deleteBtn = e.target.closest(".delete-btn");

        if (editBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const id = parseInt(editBtn.dataset.id);
          this.openPositionModal(id);
          return;
        }

        if (deleteBtn) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const id = parseInt(deleteBtn.dataset.id);
          this.deletePosition(id);
          return;
        }
      }
    };

    // Добавляем обработчик
    document.addEventListener("click", this.handleDocumentClick);
  }

  showSection(section) {
    console.log("Переход к секции:", section);

    // Скрываем все секции
    const sections = [
      "calendar", // ID: #calendarSection
      "dayForm", // ID: #dayFormSection
      "positions", // ID: #positionsSection
      "settings", // ID: #settingsSection
      "coefficients", // ID: #coefficientsSection
    ];

    // Скрываем ВСЕ секции
    sections.forEach((sec) => {
      const element = document.getElementById(`${sec}Section`);
      if (element) {
        element.style.display = "none";
      }
    });

    // Скрываем статистику, календарь и сводку по умолчанию
    const statsGrid = document.getElementById("statsGrid");
    const calendarSection = document.querySelector(".calendar-section");
    const monthSummarySection = document.getElementById("monthSummarySection");

    if (statsGrid) statsGrid.style.display = "none";
    if (calendarSection) calendarSection.style.display = "none";
    if (monthSummarySection) monthSummarySection.style.display = "none"; // Добавляем скрытие сводки

    // Показываем нужную секцию
    if (section === "calendar") {
      // Для календаря показываем основной контент
      if (statsGrid) statsGrid.style.display = "grid";
      if (calendarSection) calendarSection.style.display = "block";
      if (monthSummarySection) monthSummarySection.style.display = "block"; // Показываем сводку

      // Обновляем интерфейс
      this.updateCalendar();
      this.updateStats();
      this.updateMonthSummary(); // Обновляем сводку
    } else {
      const targetElement = document.getElementById(`${section}Section`);
      if (targetElement) {
        targetElement.style.display = "block";

        // Загружаем данные секции
        if (section === "positions") {
          this.loadPositions();
        } else if (section === "coefficients") {
          this.loadCoefficients();
        } else if (section === "settings") {
          this.loadSettings();
        }
      } else {
        console.error(`Элемент #${section}Section не найден`);
        // Fallback на календарь
        this.showCalendar();
        return;
      }
    }

    // Обновляем активную кнопку навигации
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    const navButton = document.querySelector(
      `.nav-item[data-section="${section}"]`
    );
    if (navButton) {
      navButton.classList.add("active");
    }

    // Прокручиваем вверх
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showCalendar() {
    this.showSection("calendar");

    // Явно показываем сводку
    const monthSummarySection = document.getElementById("monthSummarySection");
    if (monthSummarySection) {
      monthSummarySection.style.display = "block";
    }

    // Восстанавливаем стандартную кнопку плюса
    const quickAddBtn = document.getElementById("quickAddBtn");
    if (quickAddBtn) {
      if (this.selectedDay) {
        this.updateBottomButton(this.selectedDay);
      } else {
        quickAddBtn.innerHTML = `
        <div class="center-icon">
          <i class="fas fa-plus"></i>
        </div>
      `;
        quickAddBtn.title = "Выберите день для добавления записи";
      }
    }
  }

  changeMonth(delta) {
    let newMonth = this.currentMonth + delta;

    if (newMonth < 0) {
      newMonth = 11;
      this.currentYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      this.currentYear++;
    }

    this.currentMonth = newMonth;
    document.getElementById("monthSelect").value = newMonth;
    document.getElementById("currentMonth").textContent = `${this.getMonthName(
      newMonth
    )} ${this.currentYear}`;

    this.updateCalendar();
    this.updateStats();
    this.updateMonthSummary(); // Добавляем обновление сводки

    // Убеждаемся, что сводка видна при переключении месяца
    const monthSummarySection = document.getElementById("monthSummarySection");
    if (monthSummarySection && this.isCalendarVisible()) {
      monthSummarySection.style.display = "block";
    }
  }

  // Проверяем, виден ли календарь
  isCalendarVisible() {
    const calendarSection = document.getElementById("calendarSection");
    return calendarSection && calendarSection.style.display !== "none";
  }

  goToToday() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    // Если сегодняшняя дата в пределах 2026 года
    if (currentYear === 2026 || currentYear === 2025 || currentYear === 2027) {
      // Устанавливаем текущий год и месяц
      this.currentYear = currentYear;
      this.currentMonth = currentMonth;

      // Устанавливаем выбранный день
      this.selectedDay = currentDay;
      this.currentDay = currentDay;

      // Обновляем интерфейс
      document.getElementById("monthSelect").value = this.currentMonth;
      document.getElementById(
        "currentMonth"
      ).textContent = `${this.getMonthName(this.currentMonth)} ${
        this.currentYear
      }`;

      // Прокручиваем к сегодняшнему дню
      setTimeout(() => {
        this.updateCalendar();
        this.updateStats();

        // Прокручиваем к выбранному дню
        const selectedDayElement = document.querySelector(
          `.calendar-day[data-day="${currentDay}"]`
        );
        if (selectedDayElement) {
          selectedDayElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });

          // Выделяем сегодняшний день
          document.querySelectorAll(".calendar-day").forEach((d) => {
            d.classList.remove("selected");
          });
          selectedDayElement.classList.add("selected");

          // Обновляем кнопку на нижней панели
          this.updateBottomButton(currentDay);
        }

        this.showToast(
          "Сегодня",
          `Перешли к ${currentDay} ${this.getMonthName(
            this.currentMonth
          ).toLowerCase()} ${currentYear}`,
          "info"
        );
      }, 100);
    } else {
      // Если сегодня не в 2026 году, показываем текущий месяц
      this.currentYear = 2026;
      this.currentMonth = currentMonth;

      document.getElementById("monthSelect").value = this.currentMonth;
      document.getElementById(
        "currentMonth"
      ).textContent = `${this.getMonthName(this.currentMonth)} ${
        this.currentYear
      }`;

      this.updateCalendar();
      this.updateStats();

      this.showToast(
        "Информация",
        "Приложение настроено на 2026 год. Показан текущий месяц.",
        "info"
      );
    }
  }

  getMonthName(monthIndex) {
    const months = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];
    return months[monthIndex];
  }

  getMonthKey() {
    return `${this.currentYear}-${String(this.currentMonth + 1).padStart(
      2,
      "0"
    )}`;
  }

  getDayKey(day) {
    return `${this.currentYear}-${String(this.currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;
  }

  updateCalendar() {
    const monthKey = this.getMonthKey();
    const monthData = this.data.months[monthKey] || {
      days: {},
      calculated: { total: 0, premium: 0, perPerson: 0 },
    };

    const date = new Date(this.currentYear, this.currentMonth, 1);
    const firstDay = (date.getDay() + 6) % 7;
    const lastDay = new Date(
      this.currentYear,
      this.currentMonth + 1,
      0
    ).getDate();
    const today = new Date();

    let calendarHTML = "";

    for (let i = 0; i < firstDay; i++) {
      calendarHTML += '<div class="calendar-day empty"></div>';
    }

    for (let day = 1; day <= lastDay; day++) {
      const dayKey = this.getDayKey(day);
      const dayData = monthData.days[dayKey];
      const isWeekend = (firstDay + day - 1) % 7 >= 5;
      const isToday =
        today.getFullYear() === this.currentYear &&
        today.getMonth() === this.currentMonth &&
        today.getDate() === day;
      const isFilled = dayData && dayData.entries && dayData.entries.length > 0;
      const isSelected = this.selectedDay === day;

      let dayClass = "calendar-day";
      if (isWeekend) dayClass += " weekend";
      if (isToday) dayClass += " today";
      if (isFilled) dayClass += " filled";
      if (isSelected) dayClass += " selected";

      calendarHTML += `
      <div class="${dayClass}" data-day="${day}">
        <div class="day-number">${day}</div>
        ${
          isFilled
            ? `<div class="day-total">${dayData.dailyTotal.toLocaleString()} ₽</div>`
            : ""
        }
        ${isFilled ? '<div class="day-indicator"></div>' : ""}
      </div>
    `;
    }

    const calendarGrid = document.getElementById("calendarGrid");
    calendarGrid.innerHTML = calendarHTML;

    // Очищаем старые обработчики через клонирование
    const newCalendarGrid = calendarGrid.cloneNode(true);
    calendarGrid.parentNode.replaceChild(newCalendarGrid, calendarGrid);

    // Устанавливаем обработчики на новом элементе
    this.setupCalendarHandlers(newCalendarGrid);
  }

  // Новый метод для установки всех обработчиков календаря
  setupCalendarHandlers(calendarGrid) {
    let lastClickTime = 0;
    let lastClickDay = null;

    // Обработчик клика для одинарного и двойного клика
    calendarGrid.addEventListener("click", (e) => {
      const dayElement = e.target.closest(".calendar-day:not(.empty)");
      if (!dayElement) return;

      const dayNumber = parseInt(dayElement.dataset.day);
      const currentTime = Date.now();

      // Проверяем двойной клик (клик на тот же день в течение 300мс)
      if (lastClickDay === dayNumber && currentTime - lastClickTime < 300) {
        // Двойной клик - открываем форму
        e.preventDefault();
        e.stopPropagation();

        this.selectedDay = dayNumber;
        this.currentDay = dayNumber;
        this.openDayForm(dayNumber);

        // Сбрасываем значения
        lastClickTime = 0;
        lastClickDay = null;

        this.showToast(
          "День открыт",
          `Редактирование ${dayNumber} ${this.getMonthName(
            this.currentMonth
          ).toLowerCase()}`,
          "info"
        );

        return; // Выходим, не выполняем одинарный клик
      }

      // Одинарный клик - выделяем день
      lastClickDay = dayNumber;
      lastClickTime = currentTime;

      // Выделяем день
      document.querySelectorAll(".calendar-day").forEach((d) => {
        d.classList.remove("selected");
      });
      dayElement.classList.add("selected");

      this.selectedDay = dayNumber;
      this.currentDay = dayNumber;
      this.updateBottomButton(dayNumber);

      // Сбрасываем через 300мс
      setTimeout(() => {
        lastClickTime = 0;
        lastClickDay = null;
      }, 300);
    });

    // Добавляем обработчики свайпа
    this.setupCalendarSwipeHandlers(calendarGrid);
  }

  // Метод для обработки свайпа в календаре:
  setupCalendarSwipeHandlers(calendarGrid) {
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50;

    calendarGrid.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );

    calendarGrid.addEventListener(
      "touchend",
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
          if (diff > 0) {
            this.changeMonth(1); // Свайп влево - следующий месяц
          } else {
            this.changeMonth(-1); // Свайп вправо - предыдущий месяц
          }
        }
      },
      { passive: true }
    );

    // Для десктопа
    let mouseStartX = 0;
    let mouseEndX = 0;

    calendarGrid.addEventListener("mousedown", (e) => {
      mouseStartX = e.clientX;
    });

    calendarGrid.addEventListener("mouseup", (e) => {
      mouseEndX = e.clientX;
      const diff = mouseEndX - mouseStartX;

      if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
          this.changeMonth(-1); // Свайп вправо - предыдущий месяц
        } else {
          this.changeMonth(1); // Свайп влево - следующий месяц
        }
      }
    });
  }

  updateBottomButton(dayNumber) {
    const quickAddBtn = document.getElementById("quickAddBtn");
    if (!quickAddBtn) return;

    console.log("Updating bottom button for day:", dayNumber);

    // Обязательно сохраняем день
    this.selectedDay = dayNumber;
    this.currentDay = dayNumber;

    const monthKey = this.getMonthKey();
    const dayKey = this.getDayKey(dayNumber);
    const monthData = this.data.months[monthKey] || { days: {} };
    const dayData = monthData.days[dayKey];
    const isFilled = dayData && dayData.entries && dayData.entries.length > 0;

    if (isFilled) {
      quickAddBtn.innerHTML = `
      <div class="center-icon" style="background: #f59e0b;">
        <i class="fas fa-edit"></i>
      </div>
    `;
      quickAddBtn.title = "Редактировать выбранный день";
      quickAddBtn.dataset.day = dayNumber;
    } else {
      quickAddBtn.innerHTML = `
      <div class="center-icon">
        <i class="fas fa-plus"></i>
      </div>
    `;
      quickAddBtn.title = "Добавить запись за выбранный день";
      quickAddBtn.dataset.day = dayNumber;
    }
  }

  updateStats() {
    const monthKey = this.getMonthKey();
    const monthData = this.data.months[monthKey] || {
      days: {},
      calculated: { total: 0, premium: 0, perPerson: 0 },
    };

    // Пересчитываем если нужно
    if (!monthData.calculated || this.shouldRecalculate(monthData)) {
      this.calculateMonth(monthKey);
    }

    const { total, premium, perPerson } = monthData.calculated;

    document.getElementById(
      "totalAmount"
    ).textContent = `${total.toLocaleString()} ₽`;
    document.getElementById(
      "premiumAmount"
    ).textContent = `${premium.toLocaleString()} ₽`;
    document.getElementById(
      "perPersonAmount"
    ).textContent = `${perPerson.toLocaleString()} ₽`;

    // Обновляем сводку только если календарь видим
    if (this.isCalendarVisible()) {
      this.updateMonthSummary();
    }
  }

  shouldRecalculate(monthData) {
    // Проверяем, нужно ли пересчитывать месяц
    const totalFromDays = Object.values(monthData.days || {}).reduce(
      (sum, day) => sum + (day.dailyTotal || 0),
      0
    );
    return totalFromDays !== monthData.calculated.total;
  }

  calculateMonth(monthKey) {
    const monthData = this.data.months[monthKey] || { days: {} };
    const days = Object.values(monthData.days || {});

    const total = days.reduce((sum, day) => sum + (day.dailyTotal || 0), 0);
    const coefficient =
      this.data.coefficients[monthKey] || this.data.settings.defaultCoefficient;
    const premium = total * coefficient;
    const perPerson = (total + premium) / this.data.settings.personCount;

    monthData.calculated = {
      total: Math.round(total),
      premium: Math.round(premium),
      perPerson: Math.round(perPerson),
    };

    this.data.months[monthKey] = monthData;
    this.saveData();
  }

  openDayForm(day) {
    // Пробуем получить день из разных источников
    if (!day && this.selectedDay) {
      day = this.selectedDay;
    }

    // Если все еще нет дня, пробуем получить из currentDay
    if (!day && this.currentDay) {
      day = this.currentDay;
    }

    if (!day) {
      this.showToast("Ошибка", "Сначала выберите день в календаре", "error");
      return;
    }

    this.currentDay = day; // Устанавливаем явно
    const monthKey = this.getMonthKey();
    const dayKey = this.getDayKey(day);
    const monthData = this.data.months[monthKey] || { days: {} };
    const dayData = monthData.days[dayKey] || {
      entries: [],
      dailyTotal: 0,
      timeStart: "08:00",
      timeEnd: "17:00",
    };

    // Обновляем заголовок в формате "01.01.2026 Пт"
    const date = new Date(this.currentYear, this.currentMonth, day);
    const dayFormatted = String(day).padStart(2, "0");
    const monthFormatted = String(this.currentMonth + 1).padStart(2, "0");
    const weekdayShort = date.toLocaleDateString("ru-RU", { weekday: "short" });

    const fullDate = `${dayFormatted}.${monthFormatted}.${this.currentYear} ${weekdayShort}`;
    document.getElementById("dayTitle").textContent = fullDate;

    // Загружаем записи
    this.loadDayEntries(dayData.entries);

    // Устанавливаем время работы из сохраненных данных
    setTimeout(() => {
      const workTimeStart = document.getElementById("workTimeStart");
      const workTimeEnd = document.getElementById("workTimeEnd");

      if (workTimeStart && dayData.timeStart) {
        workTimeStart.value = dayData.timeStart;
      }

      if (workTimeEnd && dayData.timeEnd) {
        workTimeEnd.value = dayData.timeEnd;
      }

      // Обновляем итог
      this.updateDayTotal();
    }, 100);

    // Обновляем итог в заголовке формы
    document.getElementById(
      "dayTotalValue"
    ).textContent = `${dayData.dailyTotal.toLocaleString()} ₽`;

    // Показываем форму
    this.showSection("dayForm");

    // Исправление прокрутки на мобильных
    setTimeout(() => {
      const entriesList = document.getElementById("entriesList");
      if (entriesList) {
        // Принудительно пересчитываем высоту
        entriesList.style.display = "none";
        entriesList.offsetHeight; // Принудительный reflow
        entriesList.style.display = "block";

        // Если много записей, прокручиваем вниз
        if (entriesList.scrollHeight > entriesList.clientHeight + 100) {
          setTimeout(() => {
            entriesList.scrollTop = entriesList.scrollHeight;
          }, 300);
        }
      }
    }, 200);
  }

  loadDayEntries(entries) {
    const container = document.getElementById("entriesList");
    container.innerHTML = "";

    // Создаем блок для времени работы если его нет
    const daySummaryContent = document.querySelector(".day-summary-content");
    if (daySummaryContent && !document.getElementById("dayWorkHours")) {
      // Создаем блок для времени работы
      const workHoursHTML = `
  <div class="day-work-hours" id="dayWorkHours">
    <div class="work-hours-header">
      <div class="work-hours-label">Время работы</div>
      <div class="work-hours-inputs">
        <input type="time" id="workTimeStart" class="input work-time-input" 
               value="08:00" placeholder="Начало">
        <span class="work-hours-separator">—</span>
        <input type="time" id="workTimeEnd" class="input work-time-input" 
               value="17:00" placeholder="Конец">
      </div>
    </div>
  </div>
  `;

      // Проверяем, есть ли уже блок с временем
      if (!document.getElementById("dayWorkHours")) {
        // Вставляем после day-summary и перед entries-list
        const daySummary = document.querySelector(".day-summary");
        if (daySummary) {
          daySummary.insertAdjacentHTML("afterend", workHoursHTML);
        }
      }

      // Добавляем обработчики
      setTimeout(() => {
        const workTimeStart = document.getElementById("workTimeStart");
        const workTimeEnd = document.getElementById("workTimeEnd");

        if (workTimeStart) {
          workTimeStart.addEventListener("change", () => this.updateDayTotal());
        }
        if (workTimeEnd) {
          workTimeEnd.addEventListener("change", () => this.updateDayTotal());
        }
      }, 50);

      // Находим блок для отображения итогового времени
      const dayHoursContainer = document.getElementById("dayHoursContainer");

      if (dayHoursContainer) {
        // Вставляем перед блоком с итоговым временем
        dayHoursContainer.insertAdjacentHTML("beforebegin", workHoursHTML);

        // Добавляем обработчики с небольшой задержкой чтобы DOM успел обновиться
        setTimeout(() => {
          const workTimeStart = document.getElementById("workTimeStart");
          const workTimeEnd = document.getElementById("workTimeEnd");

          if (workTimeStart) {
            workTimeStart.addEventListener("change", () =>
              this.updateDayTotal()
            );
          }
          if (workTimeEnd) {
            workTimeEnd.addEventListener("change", () => this.updateDayTotal());
          }
        }, 50);
      }
    }

    if (!entries || entries.length === 0) {
      this.addEntry();
      return;
    }

    entries.forEach((entry, index) => {
      this.createEntryRow(index, entry);
    });

    // Добавляем пустую строку если меньше 3
    while (container.children.length < 3) {
      this.addEntry();
    }

    // Пересчитываем итоги
    this.updateDayTotal();
  }

  createEntryRow(index, entry = null) {
    const container = document.getElementById("entriesList");
    const row = document.createElement("div");
    row.className = "entry-card";
    row.dataset.index = index;

    const positionId = entry ? entry.positionId : "";
    const quantity = entry ? entry.quantity : "";
    const position = entry
      ? this.data.positions.find((p) => p.id === positionId)
      : null;
    const positionName = position ? position.name : "";
    const positionPrice = position ? position.price : 0;

    row.innerHTML = `
    <div class="entry-header">
      <div class="entry-number">Позиция ${index + 1}</div>
      <button class="delete-entry" type="button" data-index="${index}">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="entry-fields">
      <div class="form-field">
        <label>Позиция</label>
        <select class="input position-select" data-index="${index}">
          <option value="">Выберите позицию</option>
          ${this.data.positions
            .map(
              (p) => `
              <option value="${p.id}" ${positionId === p.id ? "selected" : ""}>
                ${p.name} (${p.price.toLocaleString()} ₽)
              </option>
            `
            )
            .join("")}
        </select>
      </div>
      <div class="form-field">
        <label>Количество</label>
        <input type="number" class="input quantity-input" data-index="${index}" 
               value="${quantity}" min="0" step="1" placeholder="0">
      </div>
      <div class="entry-total" data-index="${index}">
        <div class="entry-total-row">
          <span>Сумма:</span>
          <span class="entry-total-value">${
            entry ? (quantity * positionPrice).toLocaleString() : "0"
          } ₽</span>
        </div>
      </div>
    </div>
  `;

    container.appendChild(row);

    // Обработчики
    const positionSelect = row.querySelector(".position-select");
    const quantityInput = row.querySelector(".quantity-input");
    const deleteBtn = row.querySelector(".delete-entry");

    positionSelect.addEventListener("change", () =>
      this.updateEntryTotal(index)
    );
    quantityInput.addEventListener("input", () => this.updateEntryTotal(index));
    deleteBtn.addEventListener("click", () => this.deleteEntry(index));
  }

  // Метод для расчета отработанных часов с учетом перерыва
  calculateWorkHours(startTime, endTime) {
    if (!startTime || !endTime || startTime === "" || endTime === "") return 0;

    try {
      const startParts = startTime.split(":");
      const endParts = endTime.split(":");

      if (startParts.length < 2 || endParts.length < 2) return 0;

      const startHour = parseInt(startParts[0]) || 0;
      const startMinute = parseInt(startParts[1]) || 0;
      const endHour = parseInt(endParts[0]) || 0;
      const endMinute = parseInt(endParts[1]) || 0;

      let totalMinutes =
        endHour * 60 + endMinute - (startHour * 60 + startMinute);

      // Вычитаем 1 час (60 минут) на перерыв
      totalMinutes = Math.max(0, totalMinutes - 60);

      // Округляем до ближайших 15 минут
      const roundedMinutes = Math.round(totalMinutes / 15) * 15;

      // Возвращаем в часах с долями
      return roundedMinutes / 60;
    } catch (error) {
      console.error("Ошибка расчета времени:", error);
      return 0;
    }
  }

  // Метод для форматирования часов в читаемый вид
  formatWorkHours(hours) {
    const totalMinutes = Math.round(hours * 60);
    const hoursPart = Math.floor(totalMinutes / 60);
    const minutesPart = totalMinutes % 60;

    if (hoursPart === 0 && minutesPart === 0) {
      return "0ч 0м";
    }

    if (minutesPart === 0) {
      return `${hoursPart}ч`;
    }

    if (hoursPart === 0) {
      return `${minutesPart}м`;
    }

    return `${hoursPart}ч ${minutesPart}м`;
  }

  // Метод для расчета общего времени за день
  calculateTotalWorkHours(entries) {
    if (!entries || entries.length === 0) return 0;

    let totalHours = 0;
    entries.forEach((entry) => {
      if (entry.timeStart && entry.timeEnd) {
        totalHours += this.calculateWorkHours(entry.timeStart, entry.timeEnd);
      }
    });

    return totalHours;
  }

  addEntry() {
    const container = document.getElementById("entriesList");
    const index = container.children.length;
    this.createEntryRow(index);

    // Прокручиваем к новой строке плавно
    setTimeout(() => {
      const lastEntry = container.lastElementChild;
      if (lastEntry) {
        // Добавляем класс для анимации
        lastEntry.classList.add("adding");

        // Прокручиваем с учетом нижней панели
        const scrollOptions = {
          behavior: "smooth",
          block: "center",
        };

        // На мобильных устройствах используем другой подход
        if ("ontouchstart" in window) {
          // Для мобильных: прокручиваем контейнер, а не страницу
          lastEntry.scrollIntoView(scrollOptions);
        } else {
          lastEntry.scrollIntoView(scrollOptions);
        }

        // Убираем класс анимации после завершения
        setTimeout(() => {
          lastEntry.classList.remove("adding");
        }, 500);
      }
    }, 50);
  }

  deleteEntry(index) {
    const container = document.getElementById("entriesList");
    const rows = Array.from(container.children);

    if (rows.length > 1) {
      rows[index].remove();

      // Перенумеровываем оставшиеся строки
      rows.forEach((row, i) => {
        if (row.dataset.index > index) {
          row.dataset.index = i - 1;
          row.querySelector(".entry-number").textContent = `Позиция ${i}`;
          row.querySelectorAll("[data-index]").forEach((el) => {
            el.dataset.index = i - 1;
          });
        }
      });

      this.updateDayTotal();
    } else {
      this.showToast("Ошибка", "Должна быть хотя бы одна позиция", "error");
    }
  }

  updateEntryTotal(index) {
    const container = document.getElementById("entriesList");
    const row = container.querySelector(`[data-index="${index}"]`);
    if (!row) return { total: 0, workHours: 0 };

    const positionSelect = row.querySelector(".position-select");
    const quantityInput = row.querySelector(".quantity-input");
    const totalElement = row.querySelector(".entry-total-value");

    const positionId = positionSelect.value;
    const quantity = parseFloat(quantityInput.value) || 0;

    // Обновляем сумму
    let total = 0;
    if (positionId && quantity > 0) {
      const position = this.data.positions.find((p) => p.id == positionId);
      if (position) {
        total = position.price * quantity;
      }
    }

    // Убедитесь, что обновляется DOM
    if (totalElement) {
      totalElement.textContent = `${total.toLocaleString()} ₽`;
    }

    // Время теперь рассчитывается отдельно для всего дня
    return { total, workHours: 0 };
  }

  updateDayTotal() {
    const container = document.getElementById("entriesList");
    const rows = Array.from(container.children);
    let total = 0;

    // Пересчитываем каждую запись
    rows.forEach((row, index) => {
      const result = this.updateEntryTotal(index);
      total += result.total;
    });

    // Обновляем ОДНУ сумму в заголовке
    const dayTotalElement = document.getElementById("dayTotalValue");
    if (dayTotalElement) {
      dayTotalElement.textContent = `${total.toLocaleString()} ₽`;
      dayTotalElement.classList.add("updated");
      setTimeout(() => dayTotalElement.classList.remove("updated"), 300);
    }

    // Рассчитываем и обновляем общее время работы
    const workTimeStart =
      document.getElementById("workTimeStart")?.value || "08:00";
    const workTimeEnd =
      document.getElementById("workTimeEnd")?.value || "17:00";
    const totalHours = this.calculateWorkHours(workTimeStart, workTimeEnd);

    // Обновляем блок с часами
    const hoursValue = document.querySelector(".day-summary-hours-value");

    if (hoursValue) {
      hoursValue.textContent = this.formatWorkHours(totalHours);
      hoursValue.classList.add("updated");
      setTimeout(() => hoursValue.classList.remove("updated"), 300);
    }

    return { total, totalHours };
  }

  // Создаем элемент для отображения общего времени
  createDayHoursElement() {
    const daySummaryContent = document.querySelector(".day-summary-content");
    if (!daySummaryContent) return null;

    // Проверяем, есть ли уже блок с деталями
    let detailsContainer = document.querySelector(".day-summary-details");

    if (!detailsContainer) {
      detailsContainer = document.createElement("div");
      detailsContainer.className = "day-summary-details";
      daySummaryContent.appendChild(detailsContainer);
    }

    // Возвращаем элемент для часов
    return {
      hoursValue: document.querySelector(".day-summary-hours-value"),
      amountValue: document.querySelector(".day-summary-amount-value"),
    };
  }

  clearDay() {
    this.showConfirmModal(
      "Очистить день",
      "Удалить все записи за этот день?",
      () => {
        const monthKey = this.getMonthKey();
        const dayKey = this.getDayKey(this.currentDay);

        // Очищаем отображение
        const container = document.getElementById("entriesList");
        container.innerHTML = "";
        this.addEntry();
        document.getElementById("dayTotalValue").textContent = "0 ₽";

        // Удаляем данные из хранилища
        if (
          this.data.months[monthKey] &&
          this.data.months[monthKey].days[dayKey]
        ) {
          delete this.data.months[monthKey].days[dayKey];

          // Если в месяце не осталось дней, удаляем месяц
          if (Object.keys(this.data.months[monthKey].days).length === 0) {
            delete this.data.months[monthKey];
          }

          // Пересчитываем месяц
          this.calculateMonth(monthKey);
          this.saveData();

          // Обновляем кнопку на нижней панели
          this.updateBottomButton(this.currentDay);
        }

        this.showToast("Очищено", "Записи удалены", "success");
      }
    );
  }

  saveDay() {
    const monthKey = this.getMonthKey();
    const dayKey = this.getDayKey(this.currentDay);

    // Получаем общее время работы
    const workTimeStart =
      document.getElementById("workTimeStart")?.value || "08:00";
    const workTimeEnd =
      document.getElementById("workTimeEnd")?.value || "17:00";
    const totalHours = this.calculateWorkHours(workTimeStart, workTimeEnd);

    // Собираем данные
    const container = document.getElementById("entriesList");
    const rows = Array.from(container.children);
    const entries = [];
    let dailyTotal = 0;
    let hasValidEntries = false;

    for (const row of rows) {
      const index = parseInt(row.dataset.index);
      const positionSelect = row.querySelector(".position-select");
      const quantityInput = row.querySelector(".quantity-input");

      const positionId = parseInt(positionSelect.value);
      const quantity = parseFloat(quantityInput.value) || 0;

      if (!positionId || quantity <= 0) continue;

      const position = this.data.positions.find((p) => p.id === positionId);
      if (!position) continue;

      hasValidEntries = true;
      const sum = position.price * quantity;

      dailyTotal += sum;

      entries.push({
        positionId,
        positionName: position.name,
        price: position.price,
        quantity,
        sum,
      });
    }

    // Если записей нет, удаляем день из данных
    if (!hasValidEntries) {
      // Проверяем, есть ли день для удаления
      const dayExists =
        this.data.months[monthKey] &&
        this.data.months[monthKey].days &&
        this.data.months[monthKey].days[dayKey];

      if (dayExists) {
        delete this.data.months[monthKey].days[dayKey];

        if (Object.keys(this.data.months[monthKey].days).length === 0) {
          delete this.data.months[monthKey];
        }

        this.showToast("Удалено", "День очищен", "success");
      } else {
        this.showToast("Информация", "Нет данных для сохранения", "info");
      }
    } else {
      // Сохраняем данные дня
      if (!this.data.months[monthKey]) {
        this.data.months[monthKey] = { days: {} };
      }

      this.data.months[monthKey].days[dayKey] = {
        entries,
        dailyTotal,
        totalHours, // Сохраняем рассчитанные часы
        timeStart: workTimeStart,
        timeEnd: workTimeEnd,
      };

      this.showToast(
        "Сохранено",
        `Заработок за день: ${dailyTotal.toLocaleString()} ₽ (${this.formatWorkHours(
          totalHours
        )})`,
        "success"
      );
    }

    console.log("Daily total calculated:", dailyTotal);
    console.log("Total hours calculated:", totalHours);

    // Пересчитываем месяц и сохраняем
    this.calculateMonth(monthKey);
    this.saveData();

    // Обновляем сводку если календарь видим
    if (this.isCalendarVisible()) {
      this.updateMonthSummary();
    }

    // Обновляем кнопку на нижней панели
    this.updateBottomButton(this.currentDay);

    // Возвращаемся в календарь
    setTimeout(() => {
      this.showCalendar();
      this.updateCalendar();
    }, 500);
  }

  calculateTotalWorkHours(dayData) {
    if (!dayData || !dayData.timeStart || !dayData.timeEnd) return 0;
    return this.calculateWorkHours(dayData.timeStart, dayData.timeEnd);
  }

  loadPositions() {
    const container = document.getElementById("positionsList");
    container.innerHTML = "";

    this.data.positions.forEach((position) => {
      const item = document.createElement("div");
      item.className = "position-item";
      item.innerHTML = `
                <div class="position-info">
                    <div class="position-name">${position.name}</div>
                    <div class="position-price">${position.price.toLocaleString()} ₽</div>
                </div>
                <div class="position-actions">
                    <button class="action-btn edit-btn" data-id="${
                      position.id
                    }">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" data-id="${
                      position.id
                    }">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

      container.appendChild(item);
    });

    // УБЕРИТЕ отсюда все обработчики событий!
    // Они теперь обрабатываются в setupDelegatedEventListeners()
  }

  openPositionModal(id = null) {
    // Закрываем другие модалки сначала
    this.closeAllModals();

    this.editingPositionId = id;
    const modal = document.getElementById("positionModal");
    const title = modal.querySelector("h3");

    if (id) {
      const position = this.data.positions.find((p) => p.id === id);
      title.textContent = "Редактировать позицию";
      document.getElementById("positionName").value = position.name;
      document.getElementById("positionPrice").value = position.price;
    } else {
      title.textContent = "Новая позиция";
      document.getElementById("positionName").value = "";
      document.getElementById("positionPrice").value = "";
    }

    this.showModal("positionModal");
  }

  savePosition() {
    const name = document.getElementById("positionName").value.trim();
    const price = parseFloat(document.getElementById("positionPrice").value);

    if (!name || !price || price <= 0) {
      this.showToast("Ошибка", "Заполните все поля правильно", "error");
      return;
    }

    if (this.editingPositionId) {
      // Обновление
      const position = this.data.positions.find(
        (p) => p.id === this.editingPositionId
      );
      position.name = name;
      position.price = price;
      this.showToast("Обновлено", "Позиция изменена", "success");
    } else {
      // Создание
      const newId =
        this.data.positions.length > 0
          ? Math.max(...this.data.positions.map((p) => p.id)) + 1
          : 1;

      this.data.positions.push({
        id: newId,
        name,
        price,
      });
      this.showToast("Добавлено", "Новая позиция создана", "success");
    }

    this.saveData();
    this.loadPositions();
    this.closeModal("positionModal");
  }

  deletePosition(id) {
    this.showConfirmModal(
      "Удалить позицию",
      "Удалить эту позицию? Это действие нельзя отменить.",
      () => {
        this.data.positions = this.data.positions.filter((p) => p.id !== id);
        this.saveData();
        this.loadPositions();
        this.showToast("Удалено", "Позиция удалена", "success");
      }
    );
  }

  loadCoefficients() {
    const container = document.getElementById("coefficientsList");
    container.innerHTML = "";

    for (let month = 0; month < 12; month++) {
      const monthKey = `${this.currentYear}-${String(month + 1).padStart(
        2,
        "0"
      )}`;
      const coefficient =
        this.data.coefficients[monthKey] ||
        this.data.settings.defaultCoefficient;

      const item = document.createElement("div");
      item.className = "coefficient-item";
      item.innerHTML = `
                <div class="coefficient-month">${this.getMonthName(
                  month
                )} 2026</div>
                <div class="coefficient-value">${coefficient.toFixed(2)}</div>
            `;

      container.appendChild(item);
    }
  }

  openCoefficientModal(monthIndex) {
    // Закрываем другие модалки сначала
    this.closeAllModals();

    this.editingCoefficientMonth = monthIndex;
    const monthKey = `${this.currentYear}-${String(monthIndex + 1).padStart(
      2,
      "0"
    )}`;
    const coefficient =
      this.data.coefficients[monthKey] || this.data.settings.defaultCoefficient;

    document.getElementById("coefMonthName").textContent =
      this.getMonthName(monthIndex);
    document.getElementById("coefficientValue").value = coefficient;

    this.showModal("coefficientModal");
  }

  saveCoefficient() {
    const value = parseFloat(document.getElementById("coefficientValue").value);

    if (isNaN(value) || value < 0 || value > 1) {
      this.showToast("Ошибка", "Введите число от 0 до 1", "error");
      return;
    }

    const monthKey = `${this.currentYear}-${String(
      this.editingCoefficientMonth + 1
    ).padStart(2, "0")}`;
    this.data.coefficients[monthKey] = value;

    // Пересчитываем месяц
    this.calculateMonth(monthKey);
    this.saveData();

    this.showToast("Сохранено", "Коэффициент обновлен", "success");
    this.closeModal("coefficientModal");
    this.loadCoefficients();

    // Обновляем статистику если это текущий месяц
    if (this.editingCoefficientMonth === this.currentMonth) {
      this.updateStats();
    }
  }

  loadSettings() {
    document.getElementById("personCount").value =
      this.data.settings.personCount;
    document.getElementById("defaultCoefficient").value =
      this.data.settings.defaultCoefficient;
  }

  changeTheme(theme) {
    this.data.settings.theme = theme;
    this.saveData();
    this.setupTheme();
    this.showToast("Тема", `Тема изменена на ${theme}`, "success");
  }

  exportData() {
    const dataStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `учет-работ-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    this.showToast("Экспорт", "Данные сохранены в файл", "success");
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Проверяем структуру
        if (!importedData.positions || !importedData.settings) {
          throw new Error("Неверный формат файла");
        }

        this.showConfirmModal(
          "Импорт данных",
          "Заменить текущие данные импортированными?",
          () => {
            this.data = importedData;
            this.saveData();
            this.setupTheme();
            this.showCalendar();
            this.showToast("Импорт", "Данные успешно загружены", "success");
          }
        );
      } catch (error) {
        this.showToast("Ошибка", "Неверный формат файла", "error");
      }

      event.target.value = "";
    };

    reader.readAsText(file);
  }

  resetData() {
    this.showConfirmModal(
      "Сброс данных",
      "Удалить ВСЕ данные? Это действие нельзя отменить.",
      () => {
        localStorage.removeItem("workTrackerData");
        this.data = this.getInitialData();
        this.saveData();
        this.setupTheme();
        this.showCalendar();
        this.showToast("Сброс", "Все данные удалены", "success");
      }
    );
  }

  showModal(modalId) {
    document.getElementById("modalOverlay").style.display = "flex";
    document.getElementById(modalId).style.display = "block";

    // Анимация
    setTimeout(() => {
      document.getElementById(modalId).style.opacity = "1";
      document.getElementById(modalId).style.transform = "translateY(0)";
    }, 10);
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.opacity = "0";
    modal.style.transform = "translateY(20px)";

    setTimeout(() => {
      modal.style.display = "none";
      document.getElementById("modalOverlay").style.display = "none";
      this.editingPositionId = null;
      this.editingCoefficientMonth = null;
    }, 300);
  }

  closeAllModals() {
    document.querySelectorAll(".modal-content").forEach((modal) => {
      modal.style.display = "none";
    });
    document.getElementById("modalOverlay").style.display = "none";
    this.editingPositionId = null;
    this.editingCoefficientMonth = null;
  }

  showConfirmModal(title, message, onConfirm) {
    // Закрываем другие модалки
    this.closeAllModals();

    document.getElementById("confirmModalTitle").textContent = title;
    document.getElementById("confirmModalMessage").textContent = message;

    const confirmBtn = document.getElementById("confirmOkBtn");
    confirmBtn.onclick = () => {
      onConfirm();
      this.closeModal("confirmModal");
    };

    this.showModal("confirmModal");
  }

  executeConfirmedAction() {
    // Метод вызывается из модалки подтверждения
    // Реализация зависит от конкретного действия
  }

  showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");

    // Удаляем старые тосты
    const existingToasts = container.querySelectorAll(".toast");
    if (existingToasts.length >= 3) {
      existingToasts[0].classList.add("hide");
      setTimeout(() => {
        if (existingToasts[0].parentNode) {
          existingToasts[0].remove();
        }
      }, 200);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="toast-icon">
      <i class="fas fa-${
        type === "success"
          ? "check-circle"
          : type === "error"
          ? "exclamation-circle"
          : type === "warning"
          ? "exclamation-triangle"
          : "info-circle"
      }"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" type="button">
      <i class="fas fa-times"></i>
    </button>
  `;

    container.appendChild(toast);

    // Запускаем анимацию появления
    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    // Автоматическое удаление через 2.5 секунды
    const autoRemoveTimer = setTimeout(() => {
      toast.classList.add("hide");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 200);
    }, 2500);

    // Закрытие по клику
    toast.querySelector(".toast-close").addEventListener("click", () => {
      clearTimeout(autoRemoveTimer);
      toast.classList.add("hide");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
      }, 200);
    });

    // Автоматическое удаление при клике на тост
    toast.addEventListener("click", (e) => {
      if (!e.target.closest(".toast-close")) {
        clearTimeout(autoRemoveTimer);
        toast.classList.add("hide");
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 200);
      }
    });
  }
}

// Запуск приложения
document.addEventListener("DOMContentLoaded", () => {
  // Очищаем старый инстанс если есть
  if (window.app) {
    window.app = null;
  }

  // Добавляем поддержку touch events
  if ("ontouchstart" in window) {
    document.body.classList.add("touch-device");
  }

  // Регистрируем Service Worker если поддерживается
  if ("serviceWorker" in navigator) {
    // Всегда используем относительный путь
    const swPath = "./service-worker.js";

    navigator.serviceWorker
      .register(swPath)
      .then((registration) => {
        console.log(
          "ServiceWorker успешно зарегистрирован:",
          registration.scope
        );
      })
      .catch((error) => {
        console.log("ServiceWorker registration failed:", error);
        // Продолжаем работу без Service Worker
      });
  }

  // Инициализируем приложение
  window.app = new WorkTrackerApp();
});
