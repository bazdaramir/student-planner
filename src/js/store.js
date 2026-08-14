/* ==========================================================================
   store.js - single source of truth

   Two clearly separated trees:
     state.consultant  -> the plan. Read-only from the student's perspective.
     state.student     -> performance. The only thing the student writes.

   Everything else (progress, charts, reports) is DERIVED in stats.js and is
   never stored, so no number can drift out of sync with another.
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = (global.HDML = global.HDML || {});
  var util = HDML.util;
  var D = HDML.date;

  var STORAGE_PREFIX = "hdml:v1:";
  /* Points at the student id last written by this browser. Needed because a
     plan built from scratch has no embedded payload to derive the key from -
     without this pointer, a page refresh would lose the consultant's work. */
  var LAST_KEY = STORAGE_PREFIX + "__last";

  function emptyStudentProfile() {
    return {
      id: util.uid("stu"),
      firstName: "",
      lastName: "",
      nationalId: "",
      grade: "دوازدهم",
      track: "riazi",
      goal: "",
      consultantName: ""
    };
  }

  function defaultState() {
    return {
      schemaVersion: HDML.SCHEMA_VERSION,
      meta: {
        appVersion: HDML.VERSION,
        createdAt: D.now(),
        updatedAt: D.now(),
        planStamp: D.now(),
        exportedForStudent: false,
        isDemo: false
      },
      settings: {
        persianDigits: true
      },
      consultant: {
        student: emptyStudentProfile(),
        subjects: [],
        weeks: {},
        days: {},
        tasks: {},
        exams: {},
        templates: [],
        feedback: {}
      },
      student: {
        taskLogs: {},
        timers: {},
        dailyNotes: {},
        weeklyReflections: {},
        examResults: {}
      },
      ui: {
        view: "dashboard",
        currentWeekId: null,
        selectedDate: null,
        taskFilter: { status: "all", subjectId: "all", type: "all" },
        consultantUnlocked: false
      }
    };
  }

  HDML.defaultState = defaultState;
  HDML.emptyStudentProfile = emptyStudentProfile;

  var store = (HDML.store = {});

  var state = defaultState();
  var listeners = [];
  var storageAvailable = null;
  var storageKey = null;

  store.version = 0;
  store.storageError = null;

  store.get = function () {
    return state;
  };

  store.subscribe = function (fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  };

  var notifyScheduled = false;

  function notify() {
    if (notifyScheduled) return;
    notifyScheduled = true;
    /* Coalesce bursts of mutations into one render pass.
       setTimeout rather than requestAnimationFrame on purpose: rAF does not
       fire in a hidden or background tab, which would silently stall the UI
       until the tab is looked at again. */
    setTimeout(function () {
      notifyScheduled = false;
      var snapshot = listeners.slice();
      for (var i = 0; i < snapshot.length; i++) {
        try {
          snapshot[i](state);
        } catch (err) {
          if (global.console) console.error("listener failed", err);
        }
      }
    }, 0);
  }

  store.notify = notify;

  /**
   * The only way state changes. Bumps the version (invalidating memoised
   * stats), persists, and schedules one render.
   * @param {function(Object)} fn mutator receiving the live state
   * @param {{silent?:boolean, plan?:boolean}} [opts] plan:true marks the
   *        consultant plan as changed, which student files use to detect a
   *        newer plan embedded in a freshly received HTML file.
   */
  store.mutate = function (fn, opts) {
    var options = opts || {};
    fn(state);
    state.meta.updatedAt = D.now();
    if (options.plan) state.meta.planStamp = D.now();
    store.version += 1;
    store.persist();
    if (!options.silent) notify();
  };

  /** Replace the whole state (import / reset / demo). */
  store.replace = function (next, opts) {
    state = next;
    store.version += 1;
    resolveStorageKey();
    store.persist();
    if (!(opts && opts.silent)) notify();
  };

  function testStorage() {
    if (storageAvailable !== null) return storageAvailable;
    try {
      var k = "__hdml_probe__";
      global.localStorage.setItem(k, "1");
      global.localStorage.removeItem(k);
      storageAvailable = true;
    } catch (err) {
      storageAvailable = false;
      store.storageError =
        "حافظه‌ی مرورگر در دسترس نیست. اطلاعات فقط تا زمان باز بودن صفحه نگهداری می‌شود؛ لطفاً از «پشتیبان‌گیری» استفاده کنید.";
    }
    return storageAvailable;
  }

  store.isStorageAvailable = testStorage;

  /* Storage is keyed by student id so two different student files on the same
     machine never overwrite each other (file:// pages share one origin). */
  function resolveStorageKey() {
    storageKey =
      STORAGE_PREFIX +
      ((state.consultant && state.consultant.student && state.consultant.student.id) ||
        "default");
    return storageKey;
  }

  store.storageKey = function () {
    return storageKey || resolveStorageKey();
  };

  var persistPending = false;

  function writeState() {
    global.localStorage.setItem(store.storageKey(), JSON.stringify(state));
    global.localStorage.setItem(LAST_KEY, state.consultant.student.id);
  }

  store.persist = function () {
    if (!testStorage()) return;
    if (persistPending) return;
    persistPending = true;
    setTimeout(function () {
      persistPending = false;
      try {
        writeState();
        store.storageError = null;
      } catch (err) {
        store.storageError =
          "ذخیره‌سازی ناموفق بود (احتمالاً فضای حافظه پر است). لطفاً از داده‌ها خروجی پشتیبان بگیرید.";
        if (global.console) console.error(err);
      }
    }, 120);
  };

  store.persistNow = function () {
    if (!testStorage()) return false;
    try {
      writeState();
      return true;
    } catch (err) {
      return false;
    }
  };

  /** Student id this browser last saved, if any. */
  store.lastStudentId = function () {
    if (!testStorage()) return null;
    try {
      return global.localStorage.getItem(LAST_KEY);
    } catch (err) {
      return null;
    }
  };

  store.readStored = function (studentId) {
    if (!testStorage()) return null;
    try {
      var raw = global.localStorage.getItem(STORAGE_PREFIX + studentId);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  };

  store.clearStored = function () {
    if (!testStorage()) return;
    try {
      global.localStorage.removeItem(store.storageKey());
      global.localStorage.removeItem(LAST_KEY);
    } catch (err) {
    }
  };

  /** Fills in anything a older/partial payload is missing. Never throws. */
  store.normalize = function (raw) {
    var base = defaultState();
    if (!util.isObject(raw)) return base;

    var out = base;
    out.schemaVersion = HDML.SCHEMA_VERSION;

    if (util.isObject(raw.meta)) {
      out.meta.createdAt = raw.meta.createdAt || out.meta.createdAt;
      out.meta.updatedAt = raw.meta.updatedAt || out.meta.updatedAt;
      out.meta.planStamp = raw.meta.planStamp || out.meta.updatedAt;
      out.meta.exportedForStudent = !!raw.meta.exportedForStudent;
      out.meta.isDemo = !!raw.meta.isDemo;
    }

    if (util.isObject(raw.settings)) {
      out.settings.persianDigits =
        raw.settings.persianDigits === undefined
          ? true
          : !!raw.settings.persianDigits;
    }

    var c = util.isObject(raw.consultant) ? raw.consultant : {};
    out.consultant.student = Object.assign(
      emptyStudentProfile(),
      util.isObject(c.student) ? c.student : {}
    );
    if (!out.consultant.student.id) out.consultant.student.id = util.uid("stu");

    out.consultant.subjects = Array.isArray(c.subjects)
      ? c.subjects.filter(util.isObject).map(function (s, i) {
          return {
            id: s.id || util.uid("sub"),
            name: String(s.name || "بدون‌نام"),
            color: s.color || util.subjectColor(i),
            order: s.order == null ? i : s.order,
            archived: !!s.archived
          };
        })
      : [];

    out.consultant.weeks = util.isObject(c.weeks) ? c.weeks : {};
    out.consultant.days = util.isObject(c.days) ? c.days : {};
    out.consultant.tasks = util.isObject(c.tasks) ? c.tasks : {};
    out.consultant.exams = util.isObject(c.exams) ? c.exams : {};
    out.consultant.templates = Array.isArray(c.templates) ? c.templates : [];
    out.consultant.feedback = util.isObject(c.feedback) ? c.feedback : {};

    var s = util.isObject(raw.student) ? raw.student : {};
    out.student.taskLogs = util.isObject(s.taskLogs) ? s.taskLogs : {};
    out.student.timers = util.isObject(s.timers) ? s.timers : {};
    out.student.dailyNotes = util.isObject(s.dailyNotes) ? s.dailyNotes : {};
    out.student.weeklyReflections = util.isObject(s.weeklyReflections)
      ? s.weeklyReflections
      : {};
    out.student.examResults = util.isObject(s.examResults) ? s.examResults : {};

    if (util.isObject(raw.ui)) {
      out.ui.view = raw.ui.view || "dashboard";
      out.ui.currentWeekId = raw.ui.currentWeekId || null;
      out.ui.consultantUnlocked = !!raw.ui.consultantUnlocked;
    }

    /* A week that no longer exists must not be "current". */
    if (out.ui.currentWeekId && !out.consultant.weeks[out.ui.currentWeekId]) {
      out.ui.currentWeekId = null;
    }
    if (!out.ui.currentWeekId) {
      var weekIds = Object.keys(out.consultant.weeks);
      if (weekIds.length) out.ui.currentWeekId = store.pickCurrentWeek(out);
    }

    return out;
  };

  /** Week containing today, else the most recent week that has started. */
  store.pickCurrentWeek = function (st) {
    var today = D.today();
    var weeks = util.values(st.consultant.weeks).sort(function (a, b) {
      return D.compare(a.startDate, b.startDate);
    });
    if (!weeks.length) return null;
    for (var i = 0; i < weeks.length; i++) {
      if (weeks[i].startDate <= today && today <= weeks[i].endDate) {
        return weeks[i].id;
      }
    }
    var past = weeks.filter(function (w) {
      return w.startDate <= today;
    });
    if (past.length) return past[past.length - 1].id;
    return weeks[0].id;
  };

  /**
   * Boot order:
   *   1. normalise the plan embedded in this HTML file (if any)
   *   2. find the right storage bucket: the embedded student id when this file
   *      carries a plan, otherwise the id this browser last saved
   *   3. prefer local data, but report when the file carries a NEWER plan so
   *      the app can offer a non-destructive plan update
   */
  store.boot = function (embedded) {
    var fromFile = embedded ? store.normalize(embedded) : null;
    /* With no embedded plan (a plan being authored from scratch) fall back to
       the last student this browser saved, so a refresh never loses work. */
    var studentId =
      (fromFile && fromFile.consultant.student.id) || store.lastStudentId();

    var stored = studentId ? store.readStored(studentId) : null;
    var result = { source: "new", newerPlanInFile: false };

    if (stored) {
      state = store.normalize(stored);
      result.source = "storage";
      if (
        fromFile &&
        fromFile.meta.planStamp &&
        state.meta.planStamp &&
        fromFile.meta.planStamp > state.meta.planStamp
      ) {
        result.newerPlanInFile = true;
        store.pendingPlan = fromFile;
      }
    } else if (fromFile) {
      state = fromFile;
      result.source = "file";
    } else {
      state = defaultState();
    }

    util.usePersianDigits = state.settings.persianDigits !== false;
    resolveStorageKey();
    store.version += 1;
    return result;
  };

  /**
   * Adopt a newer plan from the file while KEEPING all student performance.
   * This is the consultant -> student handoff for week 2 onwards.
   */
  store.adoptPlan = function (planState) {
    store.mutate(function (st) {
      st.consultant = util.clone(planState.consultant);
      st.meta.planStamp = planState.meta.planStamp;
      st.meta.exportedForStudent = planState.meta.exportedForStudent;
      st.ui.currentWeekId = store.pickCurrentWeek(st);
    });
    store.pendingPlan = null;
  };

  var A = (HDML.actions = {});

  A.setProfile = function (patch) {
    store.mutate(function (st) {
      Object.assign(st.consultant.student, patch);
    }, { plan: true });
  };

  A.setSetting = function (key, value) {
    store.mutate(function (st) {
      st.settings[key] = value;
      if (key === "persianDigits") util.usePersianDigits = !!value;
    });
  };

  A.setUi = function (patch) {
    store.mutate(function (st) {
      Object.assign(st.ui, patch);
    });
  };

  A.addSubject = function (name, color) {
    var id = util.uid("sub");
    store.mutate(function (st) {
      st.consultant.subjects.push({
        id: id,
        name: String(name || "").trim() || "درس جدید",
        color: color || util.subjectColor(st.consultant.subjects.length),
        order: st.consultant.subjects.length,
        archived: false
      });
    }, { plan: true });
    return id;
  };

  A.updateSubject = function (id, patch) {
    store.mutate(function (st) {
      st.consultant.subjects.forEach(function (s) {
        if (s.id === id) Object.assign(s, patch);
      });
    }, { plan: true });
  };

  A.removeSubject = function (id) {
    store.mutate(function (st) {
      st.consultant.subjects = st.consultant.subjects.filter(function (s) {
        return s.id !== id;
      });
    }, { plan: true });
  };

  A.subjectsInUse = function (subjectId) {
    var st = state;
    var count = 0;
    Object.keys(st.consultant.tasks).forEach(function (id) {
      if (st.consultant.tasks[id].subjectId === subjectId) count++;
    });
    return count;
  };

  A.setDefaultSubjects = function (track) {
    var names = HDML.DEFAULT_SUBJECTS[track] || HDML.DEFAULT_SUBJECTS.other;
    store.mutate(function (st) {
      st.consultant.subjects = names.map(function (name, i) {
        return {
          id: util.uid("sub"),
          name: name,
          color: util.subjectColor(i),
          order: i,
          archived: false
        };
      });
    }, { plan: true });
  };

  /** Creates a week plus its seven day records (Saturday..Friday). */
  A.createWeek = function (startDateIso, title) {
    var start = D.weekStart(startDateIso || D.today());
    var weekId = util.uid("wk");
    var dayIds = [];
    store.mutate(function (st) {
      var index =
        util.values(st.consultant.weeks).reduce(function (max, w) {
          return Math.max(max, w.index || 0);
        }, 0) + 1;

      st.consultant.weeks[weekId] = {
        id: weekId,
        index: index,
        title: title || "هفته " + index,
        startDate: start,
        endDate: D.addDays(start, 6),
        locked: false,
        consultantNote: "",
        createdAt: D.now()
      };

      D.weekDates(start).forEach(function (iso, i) {
        var dayId = util.uid("day");
        dayIds.push(dayId);
        st.consultant.days[dayId] = {
          id: dayId,
          weekId: weekId,
          date: iso,
          dowIndex: i,
          consultantNote: ""
        };
      });

      st.ui.currentWeekId = weekId;
    }, { plan: true });
    return weekId;
  };

  A.updateWeek = function (weekId, patch) {
    store.mutate(function (st) {
      var w = st.consultant.weeks[weekId];
      if (!w) return;
      Object.assign(w, patch);
      /* Moving the start date moves every day with it. */
      if (patch.startDate) {
        w.endDate = D.addDays(patch.startDate, 6);
        util.values(st.consultant.days)
          .filter(function (d) {
            return d.weekId === weekId;
          })
          .forEach(function (d) {
            d.date = D.addDays(patch.startDate, d.dowIndex);
          });
      }
    }, { plan: true });
  };

  A.deleteWeek = function (weekId) {
    store.mutate(function (st) {
      var dayIds = util.values(st.consultant.days)
        .filter(function (d) {
          return d.weekId === weekId;
        })
        .map(function (d) {
          return d.id;
        });

      Object.keys(st.consultant.tasks).forEach(function (tid) {
        if (dayIds.indexOf(st.consultant.tasks[tid].dayId) >= 0) {
          delete st.consultant.tasks[tid];
          delete st.student.taskLogs[tid];
          delete st.student.timers[tid];
        }
      });
      dayIds.forEach(function (id) {
        delete st.consultant.days[id];
        delete st.student.dailyNotes[id];
      });
      delete st.consultant.weeks[weekId];
      delete st.student.weeklyReflections[weekId];
      delete st.consultant.feedback[weekId];

      if (st.ui.currentWeekId === weekId) {
        st.ui.currentWeekId = store.pickCurrentWeek(st);
      }
    }, { plan: true });
  };

  A.setDayNote = function (dayId, note) {
    store.mutate(function (st) {
      var d = st.consultant.days[dayId];
      if (d) d.consultantNote = note;
    }, { plan: true });
  };

  function taskDefaults() {
    return {
      subjectId: null,
      topic: "",
      title: "",
      description: "",
      type: "study",
      plannedMinutes: 60,
      startTime: "",
      targetQuestions: 0,
      priority: "normal",
      consultantNote: ""
    };
  }

  A.taskDefaults = taskDefaults;

  A.addTask = function (dayId, data) {
    var id = util.uid("tsk");
    store.mutate(function (st) {
      var siblings = util.values(st.consultant.tasks).filter(function (t) {
        return t.dayId === dayId;
      });
      st.consultant.tasks[id] = Object.assign(taskDefaults(), data, {
        id: id,
        dayId: dayId,
        order: siblings.length,
        createdAt: D.now()
      });
    }, { plan: true });
    return id;
  };

  A.updateTask = function (taskId, patch) {
    store.mutate(function (st) {
      var t = st.consultant.tasks[taskId];
      if (t) Object.assign(t, patch);
    }, { plan: true });
  };

  A.deleteTask = function (taskId) {
    store.mutate(function (st) {
      delete st.consultant.tasks[taskId];
      delete st.student.taskLogs[taskId];
      delete st.student.timers[taskId];
    }, { plan: true });
  };

  A.duplicateTask = function (taskId) {
    var newId = util.uid("tsk");
    store.mutate(function (st) {
      var t = st.consultant.tasks[taskId];
      if (!t) return;
      var copy = util.clone(t);
      copy.id = newId;
      copy.order = (t.order || 0) + 0.5;
      copy.createdAt = D.now();
      copy.title = t.title + " (کپی)";
      st.consultant.tasks[newId] = copy;
      reindexDay(st, t.dayId);
    }, { plan: true });
    return newId;
  };

  function reindexDay(st, dayId) {
    util.sortByOrder(
      util.values(st.consultant.tasks).filter(function (t) {
        return t.dayId === dayId;
      })
    ).forEach(function (t, i) {
      t.order = i;
    });
  }

  A.moveTask = function (taskId, direction) {
    store.mutate(function (st) {
      var t = st.consultant.tasks[taskId];
      if (!t) return;
      var list = util.sortByOrder(
        util.values(st.consultant.tasks).filter(function (x) {
          return x.dayId === t.dayId;
        })
      );
      var idx = list.findIndex(function (x) {
        return x.id === taskId;
      });
      var target = idx + direction;
      if (target < 0 || target >= list.length) return;
      var tmp = list[idx];
      list[idx] = list[target];
      list[target] = tmp;
      list.forEach(function (x, i) {
        x.order = i;
      });
    }, { plan: true });
  };

  A.moveTaskToDay = function (taskId, newDayId) {
    store.mutate(function (st) {
      var t = st.consultant.tasks[taskId];
      if (!t || t.dayId === newDayId) return;
      var oldDay = t.dayId;
      var siblings = util.values(st.consultant.tasks).filter(function (x) {
        return x.dayId === newDayId;
      });
      t.dayId = newDayId;
      t.order = siblings.length;
      reindexDay(st, oldDay);
    }, { plan: true });
  };

  /**
   * Builds a whole week from a plan the consultant prepared as a JSON file.
   * `plan` is the normalised shape produced by weekImport.parse().
   * Subjects that do not exist yet are created automatically.
   */
  A.createWeekFromPlan = function (plan) {
    var weekId = A.createWeek(plan.startDate, plan.title);

    store.mutate(function (st) {
      if (plan.studentName) {
        var parts = String(plan.studentName).trim().split(/\s+/);
        st.consultant.student.firstName = parts.shift() || st.consultant.student.firstName;
        if (parts.length) st.consultant.student.lastName = parts.join(" ");
      }
      if (plan.consultantName) st.consultant.student.consultantName = plan.consultantName;
      if (plan.weekNote) st.consultant.weeks[weekId].consultantNote = plan.weekNote;

      var byDow = {};
      util.values(st.consultant.days)
        .filter(function (d) {
          return d.weekId === weekId;
        })
        .forEach(function (d) {
          byDow[d.dowIndex] = d;
        });

      /* Reuse a subject with the same name, otherwise create it. */
      function subjectIdFor(name) {
        var clean = String(name || "").trim() || "سایر";
        var found = st.consultant.subjects.filter(function (s) {
          return s.name === clean;
        })[0];
        if (found) return found.id;
        var id = util.uid("sub");
        st.consultant.subjects.push({
          id: id,
          name: clean,
          color: util.subjectColor(st.consultant.subjects.length),
          order: st.consultant.subjects.length,
          archived: false
        });
        return id;
      }

      plan.days.forEach(function (planDay) {
        var day = byDow[planDay.dowIndex];
        if (!day) return;
        if (planDay.note) day.consultantNote = planDay.note;
        planDay.tasks.forEach(function (t, i) {
          var id = util.uid("tsk");
          st.consultant.tasks[id] = Object.assign(taskDefaults(), {
            id: id,
            dayId: day.id,
            subjectId: subjectIdFor(t.subject),
            topic: t.topic || "",
            title: t.title,
            description: t.description || "",
            type: t.type || "study",
            plannedMinutes: t.plannedMinutes,
            targetQuestions: t.targetQuestions || 0,
            startTime: t.startTime || "",
            priority: t.priority || "normal",
            consultantNote: t.note || "",
            order: i,
            createdAt: D.now()
          });
        });
      });
    }, { plan: true });

    return weekId;
  };

  /** Copies every task of `sourceWeekId` into a brand-new following week. */
  A.duplicateWeek = function (sourceWeekId, newStartIso) {
    var src = state.consultant.weeks[sourceWeekId];
    if (!src) return null;
    var start = D.weekStart(newStartIso || D.addDays(src.startDate, 7));
    var newWeekId = A.createWeek(start, null);

    store.mutate(function (st) {
      var srcDays = util.values(st.consultant.days).filter(function (d) {
        return d.weekId === sourceWeekId;
      });
      var newDays = util.values(st.consultant.days).filter(function (d) {
        return d.weekId === newWeekId;
      });
      var byDow = {};
      newDays.forEach(function (d) {
        byDow[d.dowIndex] = d;
      });

      srcDays.forEach(function (srcDay) {
        var target = byDow[srcDay.dowIndex];
        if (!target) return;
        target.consultantNote = srcDay.consultantNote || "";
        util
          .sortByOrder(
            util.values(st.consultant.tasks).filter(function (t) {
              return t.dayId === srcDay.id;
            })
          )
          .forEach(function (t, i) {
            var id = util.uid("tsk");
            var copy = util.clone(t);
            copy.id = id;
            copy.dayId = target.id;
            copy.order = i;
            copy.createdAt = D.now();
            st.consultant.tasks[id] = copy;
          });
      });

      st.consultant.weeks[newWeekId].consultantNote = src.consultantNote || "";
    }, { plan: true });

    return newWeekId;
  };

  A.setWeekNote = function (weekId, note) {
    store.mutate(function (st) {
      var w = st.consultant.weeks[weekId];
      if (w) w.consultantNote = note;
    }, { plan: true });
  };

  A.setConsultantFeedback = function (weekId, text) {
    store.mutate(function (st) {
      st.consultant.feedback[weekId] = { text: text, at: D.now() };
    }, { plan: true });
  };

  A.setWeekLocked = function (weekId, locked) {
    store.mutate(function (st) {
      var w = st.consultant.weeks[weekId];
      if (w) w.locked = !!locked;
    }, { plan: true });
  };

  A.saveWeekAsTemplate = function (weekId, name) {
    store.mutate(function (st) {
      var days = util.values(st.consultant.days).filter(function (d) {
        return d.weekId === weekId;
      });
      var payload = days
        .sort(function (a, b) {
          return a.dowIndex - b.dowIndex;
        })
        .map(function (d) {
          return {
            dowIndex: d.dowIndex,
            consultantNote: d.consultantNote || "",
            tasks: util
              .sortByOrder(
                util.values(st.consultant.tasks).filter(function (t) {
                  return t.dayId === d.id;
                })
              )
              .map(function (t) {
                var c = util.clone(t);
                delete c.id;
                delete c.dayId;
                delete c.createdAt;
                return c;
              })
          };
        });

      st.consultant.templates.push({
        id: util.uid("tpl"),
        name: name || "الگوی بدون نام",
        createdAt: D.now(),
        days: payload
      });
    }, { plan: true });
  };

  A.createWeekFromTemplate = function (templateId, startIso) {
    var tpl = state.consultant.templates.filter(function (t) {
      return t.id === templateId;
    })[0];
    if (!tpl) return null;
    var weekId = A.createWeek(startIso || D.today(), null);
    store.mutate(function (st) {
      var byDow = {};
      util.values(st.consultant.days)
        .filter(function (d) {
          return d.weekId === weekId;
        })
        .forEach(function (d) {
          byDow[d.dowIndex] = d;
        });

      tpl.days.forEach(function (tplDay) {
        var day = byDow[tplDay.dowIndex];
        if (!day) return;
        day.consultantNote = tplDay.consultantNote || "";
        (tplDay.tasks || []).forEach(function (t, i) {
          var id = util.uid("tsk");
          st.consultant.tasks[id] = Object.assign(taskDefaults(), t, {
            id: id,
            dayId: day.id,
            order: i,
            createdAt: D.now()
          });
        });
      });
    }, { plan: true });
    return weekId;
  };

  A.deleteTemplate = function (templateId) {
    store.mutate(function (st) {
      st.consultant.templates = st.consultant.templates.filter(function (t) {
        return t.id !== templateId;
      });
    }, { plan: true });
  };

  A.addExam = function (data) {
    var id = util.uid("exm");
    store.mutate(function (st) {
      st.consultant.exams[id] = Object.assign(
        {
          id: id,
          name: "آزمون",
          date: D.today(),
          type: "mock",
          subjectIds: [],
          targetPercentage: null,
          consultantNote: "",
          createdAt: D.now()
        },
        data,
        { id: id }
      );
    }, { plan: true });
    return id;
  };

  A.updateExam = function (examId, patch) {
    store.mutate(function (st) {
      var e = st.consultant.exams[examId];
      if (e) Object.assign(e, patch);
    }, { plan: true });
  };

  A.deleteExam = function (examId) {
    store.mutate(function (st) {
      delete st.consultant.exams[examId];
      delete st.student.examResults[examId];
    }, { plan: true });
  };

  function ensureLog(st, taskId) {
    if (!st.student.taskLogs[taskId]) {
      st.student.taskLogs[taskId] = {
        taskId: taskId,
        status: HDML.TASK_STATUS.PENDING,
        actualMinutes: null,
        timeSource: "none",
        questions: null,
        note: "",
        skipReason: null,
        skipNote: "",
        completedAt: null,
        updatedAt: D.now()
      };
    }
    return st.student.taskLogs[taskId];
  }

  A.ensureLog = ensureLog;

  A.getLog = function (taskId) {
    return state.student.taskLogs[taskId] || null;
  };

  /**
   * Completing a task. `actualMinutes === null` means the student did not
   * record a time; stats then fall back to the planned duration and flag the
   * value as "estimated" so the distinction is never lost.
   */
  A.completeTask = function (taskId, payload) {
    store.mutate(function (st) {
      var log = ensureLog(st, taskId);
      var timer = st.student.timers[taskId];
      var timerTotal = timer ? timerMinutesToCredit(sumSessions(timer)) : 0;

      log.status = HDML.TASK_STATUS.COMPLETED;
      log.completedAt = D.now();
      log.updatedAt = D.now();
      log.skipReason = null;
      log.skipNote = "";

      if (payload && payload.actualMinutes !== null && payload.actualMinutes !== undefined) {
        log.actualMinutes = Math.max(0, Math.round(payload.actualMinutes));
        log.timeSource =
          timerTotal > 0 && log.actualMinutes === Math.round(timerTotal)
            ? "timer"
            : "actual";
      } else if (timerTotal > 0) {
        log.actualMinutes = Math.round(timerTotal);
        log.timeSource = "timer";
      } else {
        log.actualMinutes = null;
        log.timeSource = "estimated";
      }

      if (payload && payload.questions) {
        log.questions = normalizeQuestions(payload.questions);
      }
      if (payload && payload.note !== undefined) log.note = payload.note;

      stopTimerInternal(st, taskId);
    });
  };

  function normalizeQuestions(q) {
    var completed = Math.max(0, util.toInt(q.completed, 0));
    var correct = Math.max(0, util.toInt(q.correct, 0));
    var wrong = Math.max(0, util.toInt(q.wrong, 0));
    var unanswered = Math.max(0, util.toInt(q.unanswered, 0));
    return {
      completed: completed,
      correct: correct,
      wrong: wrong,
      unanswered: unanswered
    };
  }

  A.normalizeQuestions = normalizeQuestions;

  /**
   * Validation shared by the completion modal and the import validator.
   * Returns an array of Persian error strings (empty = valid).
   */
  A.validateCompletion = function (values, task) {
    var errors = [];
    if (values.actualMinutes !== null && values.actualMinutes !== undefined) {
      if (!isFinite(values.actualMinutes) || values.actualMinutes < 0) {
        errors.push("زمان مطالعه نمی‌تواند منفی یا نامعتبر باشد.");
      } else if (values.actualMinutes > 24 * 60) {
        errors.push("زمان مطالعه برای یک فعالیت نمی‌تواند بیش از ۲۴ ساعت باشد.");
      }
    }
    var q = values.questions;
    if (q) {
      ["completed", "correct", "wrong", "unanswered"].forEach(function (k) {
        if (q[k] < 0 || !isFinite(q[k])) {
          errors.push("تعداد تست‌ها نمی‌تواند منفی باشد.");
        }
      });
      var breakdown = q.correct + q.wrong + q.unanswered;
      if (q.completed > 0 && breakdown > q.completed) {
        errors.push(
          "مجموع درست، غلط و نزده (" +
            util.n(breakdown) +
            ") نمی‌تواند از تعداد تست‌های زده‌شده (" +
            util.n(q.completed) +
            ") بیشتر باشد."
        );
      }
    }
    if (task && task.targetQuestions && q && q.completed > task.targetQuestions * 5) {
      errors.push("تعداد تست واردشده غیرمنطقی به نظر می‌رسد.");
    }
    return errors.filter(function (v, i, arr) {
      return arr.indexOf(v) === i;
    });
  };

  A.skipTask = function (taskId, reason, note) {
    store.mutate(function (st) {
      var log = ensureLog(st, taskId);
      log.status = HDML.TASK_STATUS.SKIPPED;
      log.skipReason = reason || "other";
      log.skipNote = note || "";
      log.completedAt = null;
      log.updatedAt = D.now();
      stopTimerInternal(st, taskId);
    });
  };

  A.resetTask = function (taskId) {
    store.mutate(function (st) {
      var log = ensureLog(st, taskId);
      log.status = HDML.TASK_STATUS.PENDING;
      log.actualMinutes = null;
      log.timeSource = "none";
      log.questions = null;
      log.skipReason = null;
      log.skipNote = "";
      log.completedAt = null;
      log.updatedAt = D.now();
    });
  };

  A.setTaskNote = function (taskId, note) {
    store.mutate(function (st) {
      var log = ensureLog(st, taskId);
      log.note = note;
      log.updatedAt = D.now();
    });
  };

  /** Manual time entry without changing completion status. */
  A.setActualMinutes = function (taskId, minutes) {
    store.mutate(function (st) {
      var log = ensureLog(st, taskId);
      if (minutes === null) {
        log.actualMinutes = null;
        log.timeSource =
          log.status === HDML.TASK_STATUS.COMPLETED ? "estimated" : "none";
      } else {
        log.actualMinutes = Math.max(0, Math.round(minutes));
        log.timeSource = "actual";
      }
      log.updatedAt = D.now();
    });
  };

  function sumSessions(timer) {
    if (!timer || !timer.sessions) return 0;
    return timer.sessions.reduce(function (acc, s) {
      return acc + (s.duration || 0);
    }, 0);
  }

  A.sumSessions = sumSessions;

  /**
   * Minutes to credit for a measured timer total.
   * Sessions under 5 seconds are already discarded as accidental taps, so any
   * surviving total was deliberate: never round it down to zero, which would
   * make a completed task look like no study happened at all.
   */
  function timerMinutesToCredit(total) {
    if (!total || total <= 0) return 0;
    return Math.max(1, Math.round(total));
  }

  A.timerMinutesToCredit = timerMinutesToCredit;

  /** Only one timer may run at a time; starting one stops any other. */
  A.startTimer = function (taskId) {
    store.mutate(function (st) {
      Object.keys(st.student.timers).forEach(function (id) {
        if (id !== taskId && st.student.timers[id].running) {
          stopTimerInternal(st, id);
        }
      });
      var timer = st.student.timers[taskId] || { sessions: [], running: null };
      if (!timer.running) {
        timer.running = { startedAt: Date.now() };
      }
      st.student.timers[taskId] = timer;
      var log = ensureLog(st, taskId);
      if (log.status === HDML.TASK_STATUS.PENDING) {
        log.status = HDML.TASK_STATUS.IN_PROGRESS;
        log.updatedAt = D.now();
      }
    });
  };

  function stopTimerInternal(st, taskId) {
    var timer = st.student.timers[taskId];
    if (!timer || !timer.running) return 0;
    var startedAt = timer.running.startedAt;
    var elapsedMs = Math.max(0, Date.now() - startedAt);
    timer.running = null;
    /* Ignore accidental taps under 5 seconds. */
    if (elapsedMs < 5000) return 0;
    timer.sessions.push({
      id: util.uid("ses"),
      startedAt: new Date(startedAt).toISOString(),
      endedAt: D.now(),
      duration: elapsedMs / 60000
    });
    return elapsedMs / 60000;
  }

  A.stopTimer = function (taskId) {
    store.mutate(function (st) {
      stopTimerInternal(st, taskId);
      var total = timerMinutesToCredit(sumSessions(st.student.timers[taskId]));
      if (total > 0) {
        var log = ensureLog(st, taskId);
        if (log.status !== HDML.TASK_STATUS.COMPLETED) {
          log.actualMinutes = total;
          log.timeSource = "timer";
          log.updatedAt = D.now();
        }
      }
    });
  };

  A.clearTimer = function (taskId) {
    store.mutate(function (st) {
      delete st.student.timers[taskId];
      var log = st.student.taskLogs[taskId];
      if (log && log.timeSource === "timer") {
        log.actualMinutes = null;
        log.timeSource = "none";
      }
    });
  };

  /** Elapsed minutes including the currently running segment. */
  A.timerMinutes = function (taskId) {
    var timer = state.student.timers[taskId];
    if (!timer) return 0;
    var total = sumSessions(timer);
    if (timer.running) {
      total += Math.max(0, Date.now() - timer.running.startedAt) / 60000;
    }
    return total;
  };

  A.runningTaskId = function () {
    var timers = state.student.timers;
    var ids = Object.keys(timers);
    for (var i = 0; i < ids.length; i++) {
      if (timers[ids[i]].running) return ids[i];
    }
    return null;
  };

  A.setDailyNote = function (dayId, note) {
    store.mutate(function (st) {
      st.student.dailyNotes[dayId] = { note: note, updatedAt: D.now() };
    });
  };

  A.setWeeklyReflection = function (weekId, patch) {
    store.mutate(function (st) {
      var cur = st.student.weeklyReflections[weekId] || {
        wentWell: "",
        difficult: "",
        improve: ""
      };
      st.student.weeklyReflections[weekId] = Object.assign(cur, patch, {
        updatedAt: D.now()
      });
    });
  };

  A.setExamResult = function (examId, data) {
    store.mutate(function (st) {
      var cur = st.student.examResults[examId] || {
        examId: examId,
        taken: false,
        taraz: null,
        rank: null,
        totalParticipants: null,
        subjectResults: [],
        analysis: { good: "", bad: "", mistakes: "", review: "", time: "" },
        studentNote: ""
      };
      st.student.examResults[examId] = Object.assign(cur, data, {
        examId: examId,
        updatedAt: D.now()
      });
    });
  };

  A.clearExamResult = function (examId) {
    store.mutate(function (st) {
      delete st.student.examResults[examId];
    });
  };

  var Q = (HDML.query = {});

  Q.weeksSorted = function (st) {
    return util.values((st || state).consultant.weeks).sort(function (a, b) {
      return D.compare(a.startDate, b.startDate);
    });
  };

  Q.daysOfWeek = function (weekId, st) {
    return util
      .values((st || state).consultant.days)
      .filter(function (d) {
        return d.weekId === weekId;
      })
      .sort(function (a, b) {
        return a.dowIndex - b.dowIndex;
      });
  };

  Q.dayByDate = function (iso, st) {
    var days = util.values((st || state).consultant.days);
    for (var i = 0; i < days.length; i++) {
      if (days[i].date === iso) return days[i];
    }
    return null;
  };

  Q.tasksOfDay = function (dayId, st) {
    return util.sortByOrder(
      util.values((st || state).consultant.tasks).filter(function (t) {
        return t.dayId === dayId;
      })
    );
  };

  Q.tasksOfWeek = function (weekId, st) {
    var s = st || state;
    var dayIds = Q.daysOfWeek(weekId, s).map(function (d) {
      return d.id;
    });
    return util.values(s.consultant.tasks).filter(function (t) {
      return dayIds.indexOf(t.dayId) >= 0;
    });
  };

  Q.subject = function (subjectId, st) {
    var subs = (st || state).consultant.subjects;
    for (var i = 0; i < subs.length; i++) {
      if (subs[i].id === subjectId) return subs[i];
    }
    return null;
  };

  Q.subjectName = function (subjectId, st) {
    var s = Q.subject(subjectId, st);
    return s ? s.name : "بدون درس";
  };

  Q.subjectColor = function (subjectId, st) {
    var s = Q.subject(subjectId, st);
    return s ? s.color : "#9aa4bb";
  };

  Q.activeSubjects = function (st) {
    return util.sortByOrder(
      (st || state).consultant.subjects.filter(function (s) {
        return !s.archived;
      })
    );
  };

  Q.examsSorted = function (st) {
    return util.values((st || state).consultant.exams).sort(function (a, b) {
      return D.compare(a.date, b.date);
    });
  };

  Q.examsInWeek = function (weekId, st) {
    var s = st || state;
    var w = s.consultant.weeks[weekId];
    if (!w) return [];
    return Q.examsSorted(s).filter(function (e) {
      return e.date >= w.startDate && e.date <= w.endDate;
    });
  };

  Q.currentWeek = function (st) {
    var s = st || state;
    return s.consultant.weeks[s.ui.currentWeekId] || null;
  };

  Q.studentFullName = function (st) {
    var p = (st || state).consultant.student;
    var name = ((p.firstName || "") + " " + (p.lastName || "")).trim();
    return name || "دانش‌آموز";
  };
})(typeof window !== "undefined" ? window : globalThis);
