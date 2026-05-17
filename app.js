const STORAGE_KEY = "teacher-dashboard-v2";


// Get students with lesson-specific random jitter for logs
function getStudentsForLesson(classId, lessonKey) {
  // Use lessonKey as a seed-like factor to make logs different per lesson
  const baseStudents = CLASS_STUDENTS_BASE[classId];
  const seed = lessonKey.split("").reduce((a, b) => a + b.charCodeAt(0), 0);

  return baseStudents.map(s => {
    const jitter = (field) => {
      const rand = Math.sin(seed + s.id.charCodeAt(0) + field.charCodeAt(0)) * 2;
      return Math.max(0, Math.floor(s[field] + rand));
    };
    return {
      ...s,
      posts: jitter("posts"),
      comments: jitter("comments"),
      likesReceived: jitter("likesReceived"),
      questions: jitter("questions"),
      evidenceMentions: jitter("evidenceMentions"),
    };
  });
}

let state = {
  currentView: "dashboard",
  selectedClassId: null,
  selectedLesson: null, // { unitId, lessonIndex }
  lessonData: {}, // { "C1-U4-1-1": { labels: {}, weights: [] } }
  vizPreferences: {
    heatmap: 0,
    radar: 0,
    network: 0,
    summary: 0,
    wordcloud: 0,
    timeline: 0,
    distribution: 0
  },
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      // Ensure new nested objects exist
      if (!state.vizPreferences) {
        state.vizPreferences = { heatmap: 0, radar: 0, network: 0, summary: 0, wordcloud: 0, timeline: 0, distribution: 0 };
      }
    } catch (e) {
      console.error("Failed to parse state", e);
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getLessonKey(classId, unitId, lessonIndex) {
  return `${classId}-${unitId}-${lessonIndex}`;
}

function getLessonPlatforms(subId, lessonIdx) {
  const tools = EDUTECH_PLATFORMS;
  const sumChars = subId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const idx1 = (lessonIdx + sumChars) % tools.length;
  const idx2 = (lessonIdx * 2 + sumChars) % tools.length;
  const tool1 = tools[idx1];
  let tool2 = idx1 !== idx2 && lessonIdx % 2 === 0 ? tools[idx2] : null;

  if (tool2) {
    const isT1Google = tool1.includes("구글");
    const isT1Whale = tool1.includes("웨일");
    const isT2Google = tool2.includes("구글");
    const isT2Whale = tool2.includes("웨일");

    if ((isT1Google && isT2Whale) || (isT1Whale && isT2Google)) {
      // Resolve clash: Replace tool2 with a non-clashing platform
      tool2 = (lessonIdx % 2 === 0) ? "퀴즈앤" : "리딩앤";
      if (tool1 === tool2) {
        tool2 = (tool1 === "퀴즈앤") ? "리딩앤" : "퀴즈앤";
      }
    }
  }
  return [tool1, tool2].filter(Boolean);
}

function getLessonNotesDefault() {
  return DEFAULT_LESSON_TODO_LIST.join("\n");
}

function getLessonNotes(ls) {
  if (ls.notes === undefined || ls.notes === null || ls.notes.trim() === "") {
    ls.notes = getLessonNotesDefault();
  }
  return ls.notes;
}

function getLessonState(key, classId, subId) {
  if (!state.lessonData[key]) {
    state.lessonData[key] = {
      labels: {}, // studentId -> 0(Low), 1(Mid), 2(High)
      weights: null,
      notes: getLessonNotesDefault(),
      participation: Math.floor(CLASS_STUDENTS_BASE[classId].length * (0.8 + Math.random() * 0.2)),
    };

    // Inheritance logic: Look for weights in previous lessons of the same sub-unit
    const prevLessons = Object.keys(state.lessonData)
      .filter(k => k.startsWith(`${classId}-${subId}-`))
      .sort();

    for (const pk of prevLessons) {
      if (state.lessonData[pk].weights) {
        state.lessonData[key].weights = [...state.lessonData[pk].weights];
        state.lessonData[key].bias = state.lessonData[pk].bias;
        state.lessonData[key].means = { ...state.lessonData[pk].means };
        state.lessonData[key].stds = { ...state.lessonData[pk].stds };
        state.lessonData[key].inherited = true;
        break;
      }
    }
  } else if (state.lessonData[key].participation === undefined) {
    state.lessonData[key].participation = Math.floor(CLASS_STUDENTS_BASE[classId].length * (0.8 + Math.random() * 0.2));
  }
  return state.lessonData[key];
}

function trainLessonModel(classId, unitId, lessonIndex) {
  const key = getLessonKey(classId, unitId, lessonIndex);
  const lessonState = getLessonState(key, classId, unitId);
  const students = getStudentsForLesson(classId, key);

  const y = students.map(s => (lessonState.labels[s.id] >= 1 ? 1 : 0));

  // Standardize features
  const means = {};
  const stds = {};
  features.forEach(f => {
    const vals = students.map(s => s[f.key]);
    means[f.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - means[f.key]) ** 2, 0) / vals.length;
    stds[f.key] = Math.sqrt(variance) || 1;
  });

  const rows = students.map(s => features.map(f => (s[f.key] - means[f.key]) / stds[f.key]));
  const weights = Array(features.length).fill(0);
  let bias = 0;

  for (let i = 0; i < 1000; i++) {
    rows.forEach((row, idx) => {
      const pred = 1 / (1 + Math.exp(-(row.reduce((sum, v, j) => sum + v * weights[j], 0) + bias)));
      const err = pred - y[idx];
      row.forEach((v, j) => { weights[j] -= 0.1 * err * v / students.length; });
      bias -= 0.1 * err / students.length;
    });
  }

  lessonState.weights = weights;
  lessonState.bias = bias;
  lessonState.means = means;
  lessonState.stds = stds;
  lessonState.inherited = false; // Now it's custom trained
  saveState();
  return lessonState;
}

// UI Rendering
let nodes = { wrapper: null, dashboard: null, calendar: null, profile: null };

function render() {
  if (!nodes.wrapper) {
    nodes.wrapper = document.getElementById("views-wrapper");
    nodes.dashboard = document.getElementById("view-dashboard");
    nodes.calendar = document.getElementById("view-calendar");
    nodes.profile = document.getElementById("view-profile");
  }
  if (!nodes.wrapper) return;

  const classCountEl = document.getElementById("dropdown-class-count");
  if (classCountEl) {
    classCountEl.innerText = `${TEACHER.subject} 교과 담당 | 총 ${CLASSES.length}개 학급 지도 중`;
  }

  const mainTab = state.currentView === "class" ? "dashboard" : state.currentView;
  let translateX = 0;
  if (mainTab === "calendar") translateX = -33.3333;
  else if (mainTab === "profile") translateX = -66.6666;

  nodes.wrapper.style.transform = `translateX(${translateX}%)`;

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === mainTab);
  });

  if (state.currentView === "dashboard" || state.currentView === "class") {
    nodes.dashboard.innerHTML = "";
    if (state.currentView === "dashboard") {
      renderDashboard(nodes.dashboard);
    } else {
      renderClassView(nodes.dashboard);
    }
  } else if (state.currentView === "calendar") {
    nodes.calendar.innerHTML = "";
    renderCalendar(nodes.calendar);
  } else if (state.currentView === "profile") {
    nodes.profile.innerHTML = "";
    renderProfile(nodes.profile);
  }
}

function renderDashboard(container) {
  const dashboard = document.createElement("div");
  dashboard.className = "dashboard-view fade-in";
  const todayStr = ["일", "월", "화", "수", "목", "금", "토"][new Date().getDay()];
  const displayDay = ["월", "화", "수", "목", "금"].includes(todayStr) ? todayStr : "월";
  const todayLessons = CLASSES.filter(c => c.timetable.some(t => t.startsWith(displayDay)));
  const lessonCount = todayLessons.length;

  dashboard.innerHTML = `
    <div class="dashboard-grid">
      <section class="class-section">
        <h3>지도 중인 학급</h3>
        <div class="class-grid">
          ${CLASSES.map(c => `
            <div class="class-card" onclick="selectClass('${c.id}')">
              <div class="class-card-header">
                <div class="class-info-main">
                  <h4>${c.name}</h4>
                  <div class="timetable-badges">
                    ${c.timetable.map(t => `<span class="time-badge">${t}</span>`).join("")}
                  </div>
                </div>
                <span class="student-pill">${c.studentCount}명</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${c.achievementRate}%"></div>
              </div>
              <p class="progress-label">학습 목표 도달율: ${c.achievementRate}%</p>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="calendar-section">
        <h3>오늘의 일정 (${displayDay}요일)</h3>
        <div class="calendar-card">
          ${todayLessons
      .sort((a, b) => {
        const pA = parseInt(a.timetable.find(t => t.startsWith(displayDay)).split(" ")[1]);
        const pB = parseInt(b.timetable.find(t => t.startsWith(displayDay)).split(" ")[1]);
        return pA - pB;
      })
      .map(c => {
        const time = c.timetable.find(t => t.startsWith(displayDay)).split(" ")[1];
        const period = parseInt(time);
        const sub = CURRICULUM[0].subUnits[period % 2];
        const lesson = 1 + (period % 3);
        return `
                <div class="schedule-item clickable" onclick="selectClass('${c.id}')">
                  <span class="time">${time}</span>
                  <div class="schedule-info">
                    <strong>${c.name}</strong>
                    <p>${sub.name} - ${lesson}차시</p>
                  </div>
                </div>
              `;
      }).join("")}
        </div>
      </section>
    </div>
  `;
  container.appendChild(dashboard);
}

function renderClassView(container) {
  const cls = CLASSES.find(c => c.id === state.selectedClassId);
  if (!cls) {
    console.warn("Class not found for ID:", state.selectedClassId);
    state.currentView = "dashboard";
    state.selectedClassId = null;
    renderDashboard(container);
    return;
  }

  const classView = document.createElement("div");
  classView.className = "class-view fade-in";

  // Isolate insights to prevent total page crash
  let insightsHtml = "";
  let latestUnitId = "U4-1";
  let latestLessonIdx = 1;
  try {
    insightsHtml = renderTopInsights(cls);

    // Find latest analyzed lesson for dynamic button
    for (let u = 5; u >= 4; u--) {
      for (let s = 2; s >= 1; s--) {
        for (let l = 6; l >= 1; l--) {
          const key = getLessonKey(cls.id, `U${u}-${s}`, l);
          if (state.lessonData[key]?.weights) {
            latestUnitId = `U${u}-${s}`;
            latestLessonIdx = l;
            break;
          }
        }
        if (latestUnitId !== "U4-1" || latestLessonIdx !== 1) break;
      }
      if (latestUnitId !== "U4-1" || latestLessonIdx !== 1) break;
    }
  } catch (e) {
    console.error("Critical error in insights:", e);
    insightsHtml = `<div class="empty-state">인사이트 로딩 중 오류가 발생했습니다.</div>`;
  }

  classView.innerHTML = `
    <header class="view-header">
      <div class="header-left">
        <button class="back-button" onclick="setView('dashboard')">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <h2>${cls.name} <span class="badge">${cls.studentCount}명</span></h2>
      </div>
      <div class="header-right">
        <button class="secondary-btn" onclick="openAnalysis('${cls.id}', '${latestUnitId}', ${latestLessonIdx}, 'insights')">전체 분석 리포트</button>
      </div>
    </header>

    <!-- Adaptive Dashboard Section -->
    <section class="dashboard-insights">
      <div class="section-header">
        <h3>학급 맞춤형 인사이트</h3>
        <p>선생님의 선호도와 학급 데이터를 기반으로 구성된 분석 결과입니다.</p>
      </div>
      <div class="insights-grid mini">
        ${insightsHtml}
      </div>
    </section>

    <div class="unit-list">
      ${CURRICULUM.map(unit => `
        <div class="unit-group">
          <h3 class="unit-title">${unit.name}</h3>
          ${unit.subUnits.map(sub => `
            <div class="sub-unit-card">
              <div class="sub-unit-header">
                <div>
                  <h4>${sub.name}</h4>
                  <p class="achievement-tag">${sub.achievement}</p>
                </div>
              </div>
              <div class="lesson-list">
                ${Array.from({ length: sub.lessons }, (_, i) => {
    const lessonIdx = i + 1;
    const key = getLessonKey(cls.id, sub.id, lessonIdx);
    const ls = getLessonState(key, cls.id, sub.id);
    const isExpanded = state.selectedLesson?.key === key;
    return `
                    <div class="lesson-item ${isExpanded ? "expanded" : ""}" data-lesson-key="${key}">
                      <div class="lesson-row" onclick="toggleLesson(this, '${sub.id}', ${lessonIdx})">
                        <div class="lesson-main-info">
                          <span class="lesson-number">${lessonIdx}차시</span>
                          <span class="lesson-topic">
                            ${LESSON_TOPICS[sub.id] ? LESSON_TOPICS[sub.id][lessonIdx - 1] || "학습 활동 진행하기" : "학습 활동 진행하기"}
                          </span>
                          <div class="platform-badges">
                            ${getLessonPlatforms(sub.id, lessonIdx).map(t => `<span class="platform-badge tool-${t.replace(/\s+/g, '')}">${t}</span>`).join("")}
                          </div>
                        </div>
                        <div class="lesson-meta">
                          <span class="participation-mini">
                            <span class="icon" style="margin-right: 4px;">
                              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </span>${ls.participation}/${cls.studentCount}
                          </span>
                          <span class="lesson-status ${ls.weights ? (ls.inherited ? "inherited" : "done") : "provisional"}">
                            ${ls.weights ? (ls.inherited ? "분석 완료(예측)" : "분석 완료") : "잠정 진단 완료"}
                          </span>
                        </div>
                      </div>
                      <div class="lesson-detail-container" style="display: ${isExpanded ? 'block' : 'none'}; overflow: hidden;">
                        ${renderLessonDetail(cls, sub, lessonIdx, ls)}
                      </div>
                    </div>
                  `;
  }).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
  container.appendChild(classView);
}

function renderLessonDetail(cls, sub, lessonIdx, ls) {
  const key = getLessonKey(cls.id, sub.id, lessonIdx);
  const students = getStudentsForLesson(cls.id, key);
  const participated = ls.participation;

  const currentGoals = LESSON_GOALS[sub.id] ? LESSON_GOALS[sub.id][lessonIdx - 1] || ["학습 목표를 달성할 수 있다."] : ["학습 목표를 달성할 수 있다."];

  return `
    <div class="lesson-detail">
      <div class="detail-grid">
        <div class="detail-info">
          <h5>학습 목표</h5>
          <ul>
            ${currentGoals.map(g => `<li>${g}</li>`).join("")}
          </ul>
          <h5>참여 현황</h5>
          <button class="participation-btn" onclick="showAttendance('${cls.id}')">
            ${participated}/${students.length}명 참여 (미참여 2명)
          </button>
          <h5 style="margin-top: 16px;">연계 에듀테크 플랫폼(xAPI 기반 로그)</h5>
          <div class="platform-integration-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
            ${getLessonPlatforms(sub.id, lessonIdx).map(t => {
    const badgeClass = `tool-${t.replace(/\s+/g, '')}`;
    return `
                <div class="platform-integration-row" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: var(--bg-hover); border-radius: 12px; border: 1px solid var(--border);">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="platform-badge ${badgeClass}" style="font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">${t}</span>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button class="integration-btn sync" onclick="syncEduTechData('${cls.id}', '${t}')" style="padding: 5px 10px; font-size: 0.75rem; font-weight: 600; border-radius: 8px; border: 1px solid var(--primary); background: transparent; color: var(--primary); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;" title="데이터 실시간 동기화">
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                      연동
                    </button>
                    <button class="integration-btn download" onclick="downloadXapiJson('${cls.id}', '${t}')" style="padding: 5px 10px; font-size: 0.75rem; font-weight: 600; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;" title="불러온 xAPI JSON 형식 파일 다운로드 받기">
                      <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      JSON 다운
                    </button>
                  </div>
                </div>
              `;
  }).join("")}
          </div>
        </div>
        <div class="detail-actions">
          <div class="todo-section">
            <div class="todo-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h5 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text);">교사 특이사항 (To-Do)</h5>
              <button class="edit-todo-btn" onclick="toggleTodoEdit('${key}')" title="특이사항 편집" style="background: none; border: none; cursor: pointer; color: var(--text-muted); transition: color 0.2s;">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
              </button>
            </div>
            
            ${(() => {
      const notesText = getLessonNotes(ls);
      const isEditing = state.editingTodos && state.editingTodos[key];

      if (isEditing) {
        return `
                  <div class="todo-edit-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
                    <textarea class="todo-textarea" id="todo-input-${key}" style="width: 100%; height: 110px; padding: 10px; border: 1px solid var(--border); border-radius: 12px; font-family: inherit; font-size: 0.85rem; resize: none; outline: none; transition: border-color 0.2s;" placeholder="한 줄당 한 개의 To-Do 입력...&#10;- [ ] 미완료 To-Do&#10;- [x] 완료된 To-Do">${notesText}</textarea>
                    <button class="todo-save-btn" onclick="saveTodos('${key}', '${cls.id}', '${sub.id}')" style="align-self: flex-end; padding: 6px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">저장</button>
                  </div>
                `;
      } else {
        const lines = notesText.split("\n").filter(l => l.trim() !== "");
        const todoItems = lines.map((line, idx) => {
          const isChecked = line.startsWith("- [x]") || line.startsWith("- [X]");
          const isTodo = line.startsWith("- [ ]") || line.startsWith("- [x]") || line.startsWith("- [X]");

          if (isTodo) {
            const text = line.replace(/- \[[xX ]\]\s*/, "");
            return `
                      <label class="todo-item" style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; cursor: pointer; font-size: 0.88rem; color: ${isChecked ? "var(--text-muted)" : "var(--text)"}; text-decoration: ${isChecked ? "line-through" : "none"}; transition: all 0.2s;">
                        <input type="checkbox" ${isChecked ? "checked" : ""} onchange="toggleTodoItem('${key}', ${idx}, '${cls.id}', '${sub.id}')" style="margin-top: 3px; cursor: pointer; accent-color: var(--primary);">
                        <span class="todo-text">${text}</span>
                      </label>
                    `;
          } else {
            return `<div class="todo-text-plain" style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 8px;">${line}</div>`;
          }
        }).join("");

        return `
                  <div class="todo-list" style="max-height: 140px; overflow-y: auto; padding-right: 4px;">
                    ${todoItems || `<div class="todo-empty" style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 20px 0;">등록된 To-Do가 없습니다.</div>`}
                  </div>
                `;
      }
    })()}
          </div>
          <button class="analysis-btn" onclick="openAnalysis('${cls.id}', '${sub.id}', ${lessonIdx})" style="margin-top: 12px; width: 100%;">학습분석 실행</button>
        </div>
      </div>
    </div>
  `;
}

window.toggleMobileMenu = () => {
  const menu = document.getElementById('main-menu');
  if (menu) {
    menu.classList.toggle('show');
  }
};

window.setView = (view) => {
  state.currentView = view;
  if (view === "dashboard") state.selectedClassId = null;
  saveState();

  const menu = document.getElementById('main-menu');
  if (menu) menu.classList.remove('show');

  render();
};

window.selectClass = (id) => {
  console.log("Selecting class:", id);
  state.selectedClassId = id;
  state.currentView = "class";
  saveState();
  render();
};

window.toggleLesson = (rowEl, unitId, lessonIdx) => {
  const itemEl = rowEl.closest('.lesson-item');
  if (!itemEl) return;
  
  const key = getLessonKey(state.selectedClassId, unitId, lessonIdx);
  const wasExpanded = state.selectedLesson?.key === key;
  
  if (wasExpanded) {
    state.selectedLesson = null;
  } else {
    state.selectedLesson = { key, unitId, lessonIdx };
  }
  saveState();

  // Close all other lesson items smoothly in the DOM without full re-render
  const allItems = document.querySelectorAll('.lesson-item');
  allItems.forEach(item => {
    if (item !== itemEl) {
      item.classList.remove('expanded');
      const detail = item.querySelector('.lesson-detail-container');
      if (detail) {
        detail.style.display = 'none';
      }
    }
  });

  // Toggle current clicked lesson item expansion
  itemEl.classList.toggle('expanded');
  const detail = itemEl.querySelector('.lesson-detail-container');
  if (detail) {
    detail.style.display = itemEl.classList.contains('expanded') ? 'block' : 'none';
  }
};

window.toggleTodoEdit = (key) => {
  if (!state.editingTodos) {
    state.editingTodos = {};
  }
  state.editingTodos[key] = !state.editingTodos[key];
  render();
};

window.saveTodos = (key, classId, subId) => {
  const inputEl = document.getElementById(`todo-input-${key}`);
  if (inputEl) {
    const val = inputEl.value;
    const ls = getLessonState(key, classId, subId);
    ls.notes = val;
    saveState();
  }
  state.editingTodos[key] = false;
  render();
};

window.toggleTodoItem = (key, lineIdx, classId, subId) => {
  const ls = getLessonState(key, classId, subId);
  const notesText = getLessonNotes(ls);
  const lines = notesText.split("\n");

  if (lines[lineIdx]) {
    const line = lines[lineIdx];
    if (line.startsWith("- [x]") || line.startsWith("- [X]")) {
      lines[lineIdx] = line.replace(/- \[[xX]\]/, "- [ ]");
    } else if (line.startsWith("- [ ]")) {
      lines[lineIdx] = line.replace(/- \[\s*\]/, "- [x]");
    }
    ls.notes = lines.join("\n");
    saveState();
  }
  render();
};

window.syncEduTechData = (classId, platform) => {
  alert(`[${platform}] 플랫폼으로부터 최신 xAPI 학습 로그 데이터를 실시간으로 연동했습니다!\n상태: 성공 (200 OK)`);
};

window.downloadXapiJson = (classId, platform) => {
  const mockXapi = {
    id: "xapi-statement-" + Math.random().toString(36).substring(2, 9),
    actor: {
      mbox: "mailto:teacher@school.edu",
      name: "김OO"
    },
    verb: {
      id: "http://adlnet.gov/expapi/verbs/retrieved",
      display: { "ko-KR": "조회함" }
    },
    object: {
      id: `http://school.edu/class/${classId}/platform/${platform.replace(/\s+/g, '')}`,
      definition: {
        name: { "ko-KR": `${platform} 학습 연동 로그 데이터` }
      }
    },
    timestamp: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(mockXapi, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `xAPI_${platform.replace(/\s+/g, '')}_${classId}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Analysis Overlay Logic
let currentAnalysis = null;

window.openAnalysis = (classId, unitId, lessonIdx, initialTab = "judgment") => {
  const key = getLessonKey(classId, unitId, lessonIdx);
  currentAnalysis = { classId, unitId, lessonIdx, key, tab: initialTab };
  renderAnalysisOverlay();
};

function renderAnalysisOverlay() {
  let overlay = document.querySelector(".analysis-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "analysis-overlay";
    document.body.appendChild(overlay);
  }

  // Save scroll position
  const modalBody = overlay.querySelector(".modal-body");
  const scrollTop = modalBody ? modalBody.scrollTop : 0;

  const { classId, unitId, lessonIdx, key, tab } = currentAnalysis;
  const ls = getLessonState(key, classId, unitId);
  const students = getStudentsForLesson(classId, key);

  overlay.innerHTML = `
    <div class="analysis-modal fade-in">
      <header class="modal-header">
        <h3>[${lessonIdx}차시] 학습 데이터 분석</h3>
        <button onclick="closeAnalysis()">✕</button>
      </header>
      <nav class="modal-tabs">
        <button class="${tab === "judgment" ? "active" : ""}" onclick="setAnalysisTab('judgment')">1. 교사 판단 입력</button>
        <button class="${tab === "formula" ? "active" : ""}" onclick="setAnalysisTab('formula')">2. 원 가중치 식</button>
        <button class="${tab === "adjust" ? "active" : ""}" onclick="setAnalysisTab('adjust')">3. 가중치 조절</button>
        <button class="${tab === "insights" ? "active" : ""}" onclick="setAnalysisTab('insights')">4. 맞춤형 인사이트</button>
      </nav>
      <div class="modal-body">
        ${tab === "judgment" ? renderJudgmentTab(students, ls) : ""}
        ${tab === "formula" ? renderFormulaTab(students, ls) : ""}
        ${tab === "adjust" ? renderAdjustTab(students, ls) : ""}
        ${tab === "insights" ? renderInsightsTab(students, ls) : ""}
      </div>
    </div>
  `;

  // Restore scroll position
  if (scrollTop) {
    overlay.querySelector(".modal-body").scrollTop = scrollTop;
  }
}

function renderJudgmentTab(students, ls) {
  // If current lesson has no weights, try to find weights from other lessons in the same sub-unit for prediction
  let predictionModel = ls.weights ? ls : null;
  if (!predictionModel) {
    const { classId, unitId } = currentAnalysis;
    const otherKeys = Object.keys(state.lessonData).filter(k => k.startsWith(`${classId}-${unitId}-`));
    for (const ok of otherKeys) {
      if (state.lessonData[ok].weights) {
        predictionModel = state.lessonData[ok];
        break;
      }
    }
  }

  return `
    <div class="tab-content">
      <div class="tab-header">
        <div class="header-info">
          <p>학생별 활동 로그를 확인하고 수준(상, 중, 하)을 판단해주세요.</p>
          ${predictionModel && predictionModel !== ls ? '<span class="info-badge">동일 소단원 내 타 차시 모델 기반 예측 데이터가 로드되었습니다.</span>' : ""}
        </div>
        <button class="primary-btn" onclick="trainAndGoToFormula()">모델 학습 시작</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>학생</th>
              ${features.map(f => `<th>${f.label}</th>`).join("")}
              <th>예측 수준</th>
              <th>교사 판단</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => {
    let predBadge = "-";
    if (predictionModel) {
      const row = features.map(f => (s[f.key] - predictionModel.means[f.key]) / predictionModel.stds[f.key]);
      const prob = 1 / (1 + Math.exp(-(row.reduce((sum, v, j) => sum + v * predictionModel.weights[j], 0) + predictionModel.bias)));
      predBadge = `<span class="badge-mini ${prob >= 0.5 ? "high" : "low"}">${prob >= 0.5 ? "상/중" : "하"} (${Math.round(prob * 100)}%)</span>`;
    }
    return `
                <tr data-student-id="${s.id}">
                  <td>${s.name}</td>
                  ${features.map(f => `<td>${s[f.key]}</td>`).join("")}
                  <td>${predBadge}</td>
                  <td>
                    <div class="rating-group">
                      <button class="${ls.labels[s.id] === 2 ? "active high" : ""}" onclick="setLabel('${s.id}', 2)">상</button>
                      <button class="${ls.labels[s.id] === 1 ? "active mid" : ""}" onclick="setLabel('${s.id}', 1)">중</button>
                      <button class="${ls.labels[s.id] === 0 ? "active low" : ""}" onclick="setLabel('${s.id}', 0)">하</button>
                    </div>
                  </td>
                </tr>
              `;
  }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderFormulaTab(students, ls) {
  if (!ls.weights) return `<div class="empty-state">먼저 모델을 학습해주세요.</div>`;

  const terms = ls.weights.map((w, i) => `${w >= 0 ? "+" : "-"} ${Math.abs(w).toFixed(2)} * ${features[i].label}`);
  const formula = `P(Good) = sigmoid(${ls.bias.toFixed(2)} ${terms.join(" ")})`;

  return `
    <div class="tab-content">
      <div class="formula-box">
        <code>${formula}</code>
      </div>
      <div class="coef-grid">
        ${features.map((f, i) => {
    const w = ls.weights[i];
    const width = Math.min(100, Math.abs(w) * 50);
    return `
            <div class="coef-item">
              <label>${f.label}</label>
              <div class="bar-track">
                <div class="bar-fill ${w >= 0 ? "pos" : "neg"}" style="width: ${width}%"></div>
              </div>
              <span>${w.toFixed(2)}</span>
            </div>
          `;
  }).join("")}
      </div>
    </div>
  `;
}

function renderAdjustTab(students, ls) {
  if (!ls.weights) return `<div class="empty-state">먼저 모델을 학습해주세요.</div>`;

  return `
    <div class="tab-content">
      <div class="tab-header">
        <p>모델이 학습한 가중치를 직접 미세 조정할 수 있습니다. 조정 즉시 아래 시뮬레이션 결과가 업데이트됩니다.</p>
        <button class="secondary-btn" onclick="resetWeights()">원래 식으로 복원</button>
      </div>
      <div class="adjust-grid">
        <div class="sliders">
          ${features.map((f, i) => {
    const w = ls.weights[i];
    return `
              <div class="slider-item">
                <div class="slider-info">
                  <label>${f.label}</label>
                  <span id="weight-val-${i}">${w.toFixed(2)}</span>
                </div>
                <input type="range" min="-5" max="5" step="0.1" value="${w}" 
                  oninput="updateWeight(${i}, this.value)">
              </div>
            `;
  }).join("")}
        </div>
        <div class="simulation">
          <h5>조정 후 예측 시뮬레이션</h5>
          <div class="table-wrap mini">
            <table>
              <thead>
                <tr><th>학생</th><th>판정 확률</th><th>예측</th></tr>
              </thead>
              <tbody id="sim-body">
                ${renderSimBody(students, ls)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderInsightsTab(students, ls) {
  if (!ls.weights) return `<div class="empty-state">먼저 모델을 학습해주세요.</div>`;

  const vizTypes = getVizTypes();
  const sortedViz = [...vizTypes].sort((a, b) => (state.vizPreferences[b.id] || 0) - (state.vizPreferences[a.id] || 0));

  return `
    <div class="tab-content insights-container">
      <div class="insights-header">
        <p>선생님께 가장 도움이 되는 시각화 방식을 선택해주세요. 피드백을 통해 대시보드가 선생님께 맞춰집니다.</p>
      </div>
      <div class="insights-grid">
        ${sortedViz.map(viz => renderInsightCard(viz, students, ls)).join("")}
      </div>
    </div>
  `;
}

function getVizTypes() {
  return [
    { id: "heatmap", title: "학습 활동 히트맵", description: "학생별 활동 지표 분포 파악" },
    { id: "radar", title: "교과 역량 방사형", description: "핵심 역량 도달도 분석" },
    { id: "network", title: "상호작용 네트워크", description: "학생 간 피드백 흐름" },
    { id: "scatter", title: "성취도 산점도", description: "참여도 대비 이해도 분포" },
    { id: "summary", title: "AI 분석 요약", description: "학급 분위기 텍스트 요약" },
    { id: "wordcloud", title: "핵심 키워드 클라우드", description: "주요 토론 어휘 빈도" },
    { id: "timeline", title: "학습 몰입도 추이", description: "수업 시간별 활동 강도" },
    { id: "distribution", title: "성취 수준 분포", description: "상/중/하 분포 그래프" }
  ];
}

function renderInsightCard(viz, students, ls) {
  return `
    <div class="insight-card" data-viz-id="${viz.id}" onclick="openVizDetail('${viz.id}', '${viz.title}')">
      <div class="insight-card-header">
        <div>
          <h6>${viz.title}</h6>
          <p>${viz.description}</p>
        </div>
        <div class="feedback-btns">
          <button class="feedback-btn ${state.vizPreferences[viz.id] > 0 ? "active-like" : ""}" onclick="event.stopPropagation(); giveVizFeedback('${viz.id}', 1)" title="좋아요">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          </button>
          <button class="feedback-btn ${state.vizPreferences[viz.id] < 0 ? "active-dislike" : ""}" onclick="event.stopPropagation(); giveVizFeedback('${viz.id}', -1)" title="싫어요">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
          </button>
        </div>
      </div>
      <div class="insight-viz-placeholder viz-${viz.id}">
        ${renderPlaceholderViz(viz.id, students, ls)}
      </div>
    </div>
  `;
}

function renderTopInsights(cls) {
  // Find latest analyzed lesson for this class
  let latestLs = null;
  let latestKey = null;
  for (let u = 5; u >= 4; u--) {
    for (let s = 2; s >= 1; s--) {
      for (let l = 6; l >= 1; l--) {
        const key = getLessonKey(cls.id, `U${u}-${s}`, l);
        if (state.lessonData[key]?.weights) {
          latestLs = state.lessonData[key];
          latestKey = key;
          break;
        }
      }
      if (latestLs) break;
    }
    if (latestLs) break;
  }

  if (!latestLs) return `<div class="empty-state mini">아직 분석된 데이터가 없습니다. 차시별 '학습분석 실행'을 먼저 진행해주세요.</div>`;

  const students = getStudentsForLesson(cls.id, latestKey);
  const vizTypes = getVizTypes();
  const sortedViz = [...vizTypes]
    .filter(v => state.vizPreferences[v.id] === undefined || state.vizPreferences[v.id] >= 0) // Hide disliked ones
    .sort((a, b) => (state.vizPreferences[b.id] || 0) - (state.vizPreferences[a.id] || 0));

  // Show top 4 in the main dashboard
  return sortedViz.slice(0, 4).map(viz => renderInsightCard(viz, students, latestLs)).join("");
}

function renderPlaceholderViz(id, students, ls) {
  if (id === "heatmap") {
    return `
      <div class="heatmap-viz">
        ${students.slice(0, 12).map(s => `
          <div class="heatmap-row">
            ${features.map(f => {
      const val = Math.min(10, s[f.key]);
      const intensity = (val / 10) * 0.8 + 0.1;
      return `<div class="heatmap-cell" style="background: rgba(99, 102, 241, ${intensity})" title="${s.name} - ${f.label}: ${s[f.key]}"></div>`;
    }).join("")}
          </div>
        `).join("")}
      </div>
    `;
  }
  if (id === "radar") {
    // Calculate averages
    const avgs = features.map(f => {
      const sum = students.reduce((acc, s) => acc + s[f.key], 0);
      return (sum / students.length) / 10; // Normalized 0-1
    });

    const points = avgs.map((v, i) => {
      const angle = (Math.PI * 2 * i / features.length) - Math.PI / 2;
      const r = 10 + v * 35; // radius 10 to 45
      return `${50 + Math.cos(angle) * r},${50 + Math.sin(angle) * r}`;
    }).join(" ");

    return `
      <div class="radar-viz">
        <svg viewBox="0 0 100 100">
          <polygon points="50,5 95,35 80,90 20,90 5,35" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
          <polygon points="${points}" fill="rgba(99, 102, 241, 0.2)" stroke="var(--primary)" stroke-width="1.5"/>
          ${features.map((f, i) => {
      const angle = (Math.PI * 2 * i / features.length) - Math.PI / 2;
      const tx = 50 + Math.cos(angle) * 48;
      const ty = 50 + Math.sin(angle) * 48;
      return `<text x="${tx}" y="${ty}" font-size="4" text-anchor="middle" fill="#64748b">${f.label.slice(0, 2)}</text>`;
    }).join("")}
        </svg>
      </div>
    `;
  }
  if (id === "distribution") {
    const labels = ls.labels ? Object.values(ls.labels) : [];
    const high = labels.filter(l => l === 2).length;
    const mid = labels.filter(l => l === 1).length;
    const low = labels.filter(l => l === 0).length;
    const max = Math.max(high, mid, low, 1);

    return `
      <div class="dist-viz">
        <div class="dist-bar high" style="height: ${(high / max) * 100}%"><span>상(${high})</span></div>
        <div class="dist-bar mid" style="height: ${(mid / max) * 100}%"><span>중(${mid})</span></div>
        <div class="dist-bar low" style="height: ${(low / max) * 100}%"><span>하(${low})</span></div>
      </div>
    `;
  }
  if (id === "summary") {
    const labels = ls.labels ? Object.values(ls.labels) : [];
    const goodRatio = students.length > 0 ? Math.round((labels.filter(l => l >= 1).length / students.length) * 100) : 0;
    return `
      <div class="summary-viz">
        현재 학급의 <strong>성취 목표 도달률은 약 ${goodRatio}%</strong>입니다. 
        특히 '${features[4].label}' 지표가 이전 차시 대비 향상되었으며, 전체적으로 활발한 토론이 이루어지고 있습니다.
      </div>
    `;
  }
  if (id === "wordcloud") {
    const words = ["타당성", "근거", "토론", "주장", "논리", "반박", "의견", "경청", "비판", "매체"];
    return `
      <div class="wordcloud-viz">
        ${words.map((w, i) => {
      const size = 12 + Math.random() * 15;
      const op = 0.5 + Math.random() * 0.5;
      return `<span style="font-size: ${size}px; opacity: ${op}; color: var(--primary)">${w}</span>`;
    }).join("")}
      </div>
    `;
  }
  if (id === "timeline") {
    return `
      <div class="timeline-viz">
        ${Array.from({ length: 12 }).map(() => {
      const h = 20 + Math.random() * 80;
      return `<div class="time-bar" style="height: ${h}%"></div>`;
    }).join("")}
      </div>
    `;
  }
  if (id === "network") {
    // Generate simple circular node network
    const nodes = Array.from({ length: 8 }).map((_, i) => {
      const angle = (Math.PI * 2 * i / 8);
      return { x: 50 + Math.cos(angle) * 35, y: 50 + Math.sin(angle) * 35 };
    });
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      links.push({ source: nodes[i], target: nodes[(i + 1) % nodes.length] });
      if (Math.random() > 0.5) links.push({ source: nodes[i], target: nodes[(i + 3) % nodes.length] });
    }
    return `
      <div class="network-viz">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          ${links.map(l => `<line x1="${l.source.x}" y1="${l.source.y}" x2="${l.target.x}" y2="${l.target.y}" stroke="#cbd5e1" stroke-width="0.5" opacity="0.6"/>`).join("")}
          ${nodes.map(n => `<circle cx="${n.x}" cy="${n.y}" r="3" fill="var(--primary)"/>`).join("")}
        </svg>
      </div>
    `;
  }
  if (id === "scatter") {
    return `
      <div class="scatter-viz">
        <svg viewBox="0 0 100 100" width="100%" height="100%">
          <!-- Axes -->
          <line x1="10" y1="90" x2="90" y2="90" stroke="#cbd5e1" stroke-width="1"/>
          <line x1="10" y1="90" x2="10" y2="10" stroke="#cbd5e1" stroke-width="1"/>
          <text x="50" y="98" font-size="4" text-anchor="middle" fill="#64748b">수업 참여도</text>
          <text x="2" y="50" font-size="4" text-anchor="middle" fill="#64748b" transform="rotate(-90 2 50)">핵심 이해도</text>
          
          <!-- Points -->
          ${students.slice(0, 15).map(s => {
      const cx = 15 + (s.participation || Math.random() * 10) / 10 * 70;
      const cy = 85 - (s.critical_thinking || Math.random() * 10) / 10 * 70;
      return `<circle cx="${cx}" cy="${cy}" r="2" fill="var(--secondary)" opacity="0.7"><title>${s.name}</title></circle>`;
    }).join("")}
        </svg>
      </div>
    `;
  }
  return `<div class="summary-viz">데이터 로딩 중...</div>`;
}

window.giveVizFeedback = (vizId, val) => {
  if (state.vizPreferences[vizId] === val) {
    state.vizPreferences[vizId] = 0; // Toggle off
  } else {
    state.vizPreferences[vizId] = val;
  }
  saveState();

  if (currentAnalysis && document.querySelector(".analysis-overlay")) {
    renderAnalysisOverlay();
  } else {
    render();
  }
};

window.openVizDetail = (vizId, vizTitle) => {
  let overlay = document.querySelector(".analysis-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "analysis-overlay";
    document.body.appendChild(overlay);
  }

  const cls = CLASSES.find(c => c.id === state.selectedClassId);
  if (!cls) return;

  let latestLs = null;
  let latestKey = null;
  for (let u = 5; u >= 4; u--) {
    for (let s = 2; s >= 1; s--) {
      for (let l = 6; l >= 1; l--) {
        const key = getLessonKey(cls.id, `U${u}-${s}`, l);
        if (state.lessonData[key]?.weights) {
          latestLs = state.lessonData[key];
          latestKey = key;
          break;
        }
      }
      if (latestLs) break;
    }
    if (latestLs) break;
  }

  if (!latestLs) return;
  const students = getStudentsForLesson(cls.id, latestKey);

  const aiNarrative = AI_NARRATIVES[vizId] || "선택된 지표에 대해 다차원 분석 데이터 분석이 진행 중입니다.";

  overlay.innerHTML = `
    <div class="viz-detail-modal fade-in">
      <header class="modal-header">
        <h3>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px; color: var(--primary);"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>${vizTitle} 상세 분석
        </h3>
        <button onclick="closeVizDetail()">✕</button>
      </header>
      <div class="viz-detail-body">
        <div class="viz-detail-chart-wrapper">
          ${renderPlaceholderViz(vizId, students, latestLs)}
        </div>
        <div class="viz-detail-report">
          <div class="viz-report-card">
            <h5>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              AI 맞춤형 진단 코멘트
            </h5>
            <p>${aiNarrative}</p>
          </div>
          <div class="viz-report-card" style="border-left-color: var(--secondary);">
            <h5>
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--secondary);"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              수업 설계 제언 (Action Plan)
            </h5>
            <p>${ACTION_PLAN_TEXT}</p>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.closeVizDetail = () => {
  const overlay = document.querySelector(".analysis-overlay");
  if (overlay) {
    overlay.remove();
  }
};

function renderSimBody(students, ls) {
  return students.map(s => {
    const row = features.map(f => (s[f.key] - ls.means[f.key]) / ls.stds[f.key]);
    const prob = 1 / (1 + Math.exp(-(row.reduce((sum, v, j) => sum + v * ls.weights[j], 0) + ls.bias)));
    const badgeClass = prob >= 0.5 ? "high" : "low";
    const badgeText = prob >= 0.5 ? "Good" : "Care";
    return `
      <tr>
        <td>${s.name}</td>
        <td>${Math.round(prob * 100)}%</td>
        <td><span class="badge-mini ${badgeClass}">${badgeText}</span></td>
      </tr>
    `;
  }).join("");
}

window.updateWeight = (idx, val) => {
  const ls = getLessonState(currentAnalysis.key, currentAnalysis.classId, currentAnalysis.unitId);
  ls.weights[idx] = parseFloat(val);
  ls.inherited = false; // Manually adjusted
  document.getElementById(`weight-val-${idx}`).textContent = parseFloat(val).toFixed(2);
  const students = getStudentsForLesson(currentAnalysis.classId, currentAnalysis.key);
  document.getElementById("sim-body").innerHTML = renderSimBody(students, ls);
  saveState();
};

window.resetWeights = () => {
  trainLessonModel(currentAnalysis.classId, currentAnalysis.unitId, currentAnalysis.lessonIdx);
  renderAnalysisOverlay();
};

window.closeAnalysis = () => {
  document.querySelector(".analysis-overlay").remove();
  currentAnalysis = null;
  render();
};

window.setAnalysisTab = (tab) => {
  currentAnalysis.tab = tab;
  renderAnalysisOverlay();
};

window.setLabel = (studentId, val) => {
  const ls = getLessonState(currentAnalysis.key, currentAnalysis.classId, currentAnalysis.unitId);
  ls.labels[studentId] = val;
  saveState();

  const row = document.querySelector(`tr[data-student-id="${studentId}"]`);
  if (row) {
    const buttons = row.querySelectorAll(".rating-group button");
    // Button order in HTML: 상(2), 중(1), 하(0)
    const valToIdx = { 2: 0, 1: 1, 0: 2 };
    const idxToClass = { 0: "high", 1: "mid", 2: "low" };

    buttons.forEach((btn, idx) => {
      btn.classList.remove("active", "high", "mid", "low");
      if (idx === valToIdx[val]) {
        btn.classList.add("active", idxToClass[idx]);
      }
    });
  }
};

window.trainAndGoToFormula = () => {
  trainLessonModel(currentAnalysis.classId, currentAnalysis.unitId, currentAnalysis.lessonIdx);
  currentAnalysis.tab = "formula";
  renderAnalysisOverlay();
};

window.showAttendance = (classId) => {
  alert(`${CLASSES.find(c => c.id === classId).name} 출석부\n결석생: 김철수, 이영희`);
};

function renderCalendar(container) {
  const calView = document.createElement("div");
  calView.className = "calendar-view fade-in";

  const days = ["월", "화", "수", "목", "금"];

  calView.innerHTML = `
    <div class="calendar-grid">
      <div class="cal-header-cell"></div>
      ${days.map(d => `<div class="cal-header-cell">${d}요일</div>`).join("")}
      ${[1, 2, 3, 4, 5, 6, 7].map(period => `
        <div class="cal-time-cell">${period}교시</div>
        ${days.map(d => {
    const matchedClass = CLASSES.find(c => c.timetable.includes(`${d} ${period}교시`));
    if (matchedClass) {
      const sub = CURRICULUM[0].subUnits[period % 2];
      const lesson = 1 + (period % 3);
      return `
              <div class="cal-cell">
                <div class="cal-cell-item" onclick="selectClass('${matchedClass.id}')">
                  ${matchedClass.name}<br>
                  <span style="font-size: 0.75rem; color: #6366f1;">${sub.name} - ${lesson}차시</span>
                </div>
              </div>
            `;
    }
    return `<div class="cal-cell"><div class="cal-cell-empty">-</div></div>`;
  }).join("")}
      `).join("")}
    </div>
  `;
  container.appendChild(calView);
}

function renderProfile(container) {
  const profView = document.createElement("div");
  profView.className = "profile-view fade-in";

  profView.innerHTML = `
    <div class="manage-section">
      <h3>학급별 학생 정보 관리</h3>
      <p style="color: var(--text-muted); margin-bottom: 16px;">각 학급을 선택하여 학생 개별 정보 및 성취도를 관리하세요.</p>
      <div class="manage-list">
        ${CLASSES.map(c => `
          <div class="manage-item">
            <div class="manage-item-info">
              <h4>${c.name}</h4>
              <p>총 인원: ${c.studentCount}명 | 평균 목표 도달율: ${c.achievementRate}%</p>
            </div>
            <div class="file-actions-grid">
              <button class="file-action-btn" onclick="alert('NEIS 학급 명단을 업로드합니다.')">
                <span class="file-action-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 16 4-4 4 4"/></svg></span> NEIS 명단 업로드
              </button>
              <button class="file-action-btn" onclick="alert('NEIS 수행평가 점수 파일을 다운로드합니다.')">
                <span class="file-action-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg></span> 수행평가 점수 다운로드
              </button>
              <button class="file-action-btn" onclick="alert('생기부 교과세특 초안 파일을 다운로드합니다.')">
                <span class="file-action-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg></span> 교과세특 초안 다운로드
              </button>
              <button class="file-action-btn" onclick="alert('에듀테크 로그 데이터 통합 Raw 파일을 다운로드합니다.')">
                <span class="file-action-icon"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M8 18v-1.5"/><path d="M16 18v-3"/></svg></span> 에듀테크 로그 Raw 다운로드
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  container.appendChild(profView);
}

loadState();
render();
