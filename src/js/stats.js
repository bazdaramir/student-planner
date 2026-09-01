/* ==========================================================================
   stats.js - THE calculation engine

   Every figure shown anywhere (dashboard, today, week, progress, daily report,
   weekly report, charts) is produced here. No view recomputes a metric on its
   own, so the same number can never disagree with itself across screens.

   Memoised against store.version: any mutation invalidates the whole cache.
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = (global.HDML = global.HDML || {});
  var util = HDML.util;
  var D = HDML.date;
  var Q = HDML.query;
  var S = (HDML.stats = {});

  var cache = {};
  var cacheVersion = -1;

  function memo(key, producer) {
    if (cacheVersion !== HDML.store.version) {
      cache = {};
      cacheVersion = HDML.store.version;
    }
    if (!(key in cache)) cache[key] = producer();
    return cache[key];
  }

  /**
   * Effective study minutes for one task, plus WHERE the number came from.
   * The distinction is never collapsed:
   *   'actual'    - the student typed a real duration
   *   'timer'     - measured by the stopwatch
   *   'estimated' - completed without a recorded time -> planned used instead
   *   'none'      - nothing studied yet
   */
  S.taskStats = function (task, st) {
    var state = st || HDML.store.get();
    var log = state.student.taskLogs[task.id] || null;
    var status = log ? log.status : HDML.TASK_STATUS.PENDING;
    var planned = Math.max(0, util.toInt(task.plannedMinutes, 0));

    var actual = 0;
    var source = "none";

    if (log && log.actualMinutes !== null && log.actualMinutes !== undefined) {
      actual = Math.max(0, log.actualMinutes);
      source = log.timeSource === "timer" ? "timer" : "actual";
    } else if (status === HDML.TASK_STATUS.COMPLETED) {
      /* Fallback so a completed task is never worth zero, but it stays
         labelled as an estimate everywhere it is shown. */
      actual = planned;
      source = "estimated";
    }

    var q = (log && log.questions) || null;
    var target = Math.max(0, util.toInt(task.targetQuestions, 0));
    var completedQ = q ? Math.max(0, q.completed) : 0;
    var correct = q ? Math.max(0, q.correct) : 0;
    var wrong = q ? Math.max(0, q.wrong) : 0;
    var unanswered = q ? Math.max(0, q.unanswered) : 0;
    var graded = correct + wrong;

    return {
      taskId: task.id,
      task: task,
      log: log,
      status: status,
      isCompleted: status === HDML.TASK_STATUS.COMPLETED,
      isSkipped: status === HDML.TASK_STATUS.SKIPPED,
      isPending: status === HDML.TASK_STATUS.PENDING,
      isInProgress: status === HDML.TASK_STATUS.IN_PROGRESS,
      plannedMinutes: planned,
      actualMinutes: actual,
      timeSource: source,
      isEstimated: source === "estimated",
      hasRecordedTime: source === "actual" || source === "timer",
      deltaMinutes: actual - planned,
      studyAchievementRate: util.pct(actual, planned),
      targetQuestions: target,
      questionsCompleted: completedQ,
      correct: correct,
      wrong: wrong,
      unanswered: unanswered,
      questionCompletionRate: util.pct(completedQ, target),
      /* Accuracy over answered questions - blanks are not "wrong". */
      accuracy: graded > 0 ? util.pct(correct, graded) : null,
      skipReason: log ? log.skipReason : null,
      note: log ? log.note : ""
    };
  };

  function blankAgg() {
    return {
      totalTasks: 0,
      completedTasks: 0,
      skippedTasks: 0,
      pendingTasks: 0,
      inProgressTasks: 0,
      plannedMinutes: 0,
      actualMinutes: 0,
      estimatedMinutes: 0,
      recordedMinutes: 0,
      targetQuestions: 0,
      completedQuestions: 0,
      correct: 0,
      wrong: 0,
      unanswered: 0
    };
  }

  function accumulate(agg, ts) {
    agg.totalTasks += 1;
    if (ts.isCompleted) agg.completedTasks += 1;
    else if (ts.isSkipped) agg.skippedTasks += 1;
    else if (ts.isInProgress) agg.inProgressTasks += 1;
    else agg.pendingTasks += 1;

    agg.plannedMinutes += ts.plannedMinutes;
    agg.actualMinutes += ts.actualMinutes;
    if (ts.isEstimated) agg.estimatedMinutes += ts.actualMinutes;
    else agg.recordedMinutes += ts.actualMinutes;

    agg.targetQuestions += ts.targetQuestions;
    agg.completedQuestions += ts.questionsCompleted;
    agg.correct += ts.correct;
    agg.wrong += ts.wrong;
    agg.unanswered += ts.unanswered;
    return agg;
  }

  function finalize(agg) {
    var graded = agg.correct + agg.wrong;
    agg.taskCompletionRate = util.pct(agg.completedTasks, agg.totalTasks);
    agg.studyAchievementRate = util.pct(agg.actualMinutes, agg.plannedMinutes);
    agg.questionCompletionRate = util.pct(
      agg.completedQuestions,
      agg.targetQuestions
    );
    agg.accuracy = graded > 0 ? util.pct(agg.correct, graded) : null;
    agg.deltaMinutes = agg.actualMinutes - agg.plannedMinutes;
    agg.hasEstimatedTime = agg.estimatedMinutes > 0;

    /* Overall score = plain mean of the components that actually apply.
       Deliberately simple and explained in the UI - never a magic number. */
    var parts = [];
    if (agg.taskCompletionRate !== null) parts.push(Math.min(100, agg.taskCompletionRate));
    if (agg.studyAchievementRate !== null)
      parts.push(Math.min(100, agg.studyAchievementRate));
    if (agg.questionCompletionRate !== null)
      parts.push(Math.min(100, agg.questionCompletionRate));
    agg.overallScore = parts.length
      ? util.round(
          parts.reduce(function (a, b) {
            return a + b;
          }, 0) / parts.length,
          1
        )
      : null;
    agg.overallParts = parts.length;
    return agg;
  }

  /** Groups a list of taskStats by subject, ordered by planned time. */
  function bySubject(taskStatsList, state) {
    var map = {};
    taskStatsList.forEach(function (ts) {
      var sid = ts.task.subjectId || "__none__";
      if (!map[sid]) {
        map[sid] = Object.assign(blankAgg(), {
          subjectId: sid,
          name:
            sid === "__none__" ? "بدون درس" : Q.subjectName(sid, state),
          color: sid === "__none__" ? "#9aa4bb" : Q.subjectColor(sid, state)
        });
      }
      accumulate(map[sid], ts);
    });
    return Object.keys(map)
      .map(function (k) {
        return finalize(map[k]);
      })
      .sort(function (a, b) {
        return b.plannedMinutes - a.plannedMinutes || b.actualMinutes - a.actualMinutes;
      });
  }

  S.bySubject = bySubject;

  S.dayStats = function (dayId, st) {
    return memo("day:" + dayId, function () {
      var state = st || HDML.store.get();
      var day = state.consultant.days[dayId];
      if (!day) return null;

      var tasks = Q.tasksOfDay(dayId, state);
      var list = tasks.map(function (t) {
        return S.taskStats(t, state);
      });
      var agg = finalize(list.reduce(accumulate, blankAgg()));

      agg.dayId = dayId;
      agg.date = day.date;
      agg.dowIndex = day.dowIndex;
      agg.dayName = D.WEEK_DAYS[day.dowIndex];
      agg.weekId = day.weekId;
      agg.taskStats = list;
      agg.bySubject = bySubject(list, state);
      agg.isToday = day.date === D.today();
      agg.isFuture = day.date > D.today();
      agg.note = (state.student.dailyNotes[dayId] || {}).note || "";
      agg.consultantNote = day.consultantNote || "";
      agg.skipped = list.filter(function (t) {
        return t.isSkipped;
      });
      return agg;
    });
  };

  S.dayStatsByDate = function (iso, st) {
    var state = st || HDML.store.get();
    var day = Q.dayByDate(iso, state);
    return day ? S.dayStats(day.id, state) : null;
  };

  S.weekStats = function (weekId, st) {
    return memo("week:" + weekId, function () {
      var state = st || HDML.store.get();
      var week = state.consultant.weeks[weekId];
      if (!week) return null;

      var days = Q.daysOfWeek(weekId, state);
      var dayList = days
        .map(function (d) {
          return S.dayStats(d.id, state);
        })
        .filter(Boolean);

      var agg = blankAgg();
      var allTaskStats = [];
      dayList.forEach(function (ds) {
        agg.totalTasks += ds.totalTasks;
        agg.completedTasks += ds.completedTasks;
        agg.skippedTasks += ds.skippedTasks;
        agg.pendingTasks += ds.pendingTasks;
        agg.inProgressTasks += ds.inProgressTasks;
        agg.plannedMinutes += ds.plannedMinutes;
        agg.actualMinutes += ds.actualMinutes;
        agg.estimatedMinutes += ds.estimatedMinutes;
        agg.recordedMinutes += ds.recordedMinutes;
        agg.targetQuestions += ds.targetQuestions;
        agg.completedQuestions += ds.completedQuestions;
        agg.correct += ds.correct;
        agg.wrong += ds.wrong;
        agg.unanswered += ds.unanswered;
        allTaskStats = allTaskStats.concat(ds.taskStats);
      });
      finalize(agg);

      agg.weekId = weekId;
      agg.week = week;
      agg.days = dayList;
      agg.taskStats = allTaskStats;
      agg.bySubject = bySubject(allTaskStats, state);

      /* Only days that have actually happened count towards the average and
         the best/weakest comparison - future days would drag them to zero.
         A day the student has already worked on counts as happened even if
         its date is still ahead, so a report can never show study time while
         claiming no day has elapsed. */
      var elapsed = dayList.filter(function (d) {
        if (d.totalTasks === 0) return false;
        if (!d.isFuture) return true;
        return d.actualMinutes > 0 || d.completedTasks > 0 || d.skippedTasks > 0;
      });
      agg.elapsedDays = elapsed.length;
      agg.averageDailyMinutes = elapsed.length
        ? Math.round(
            elapsed.reduce(function (a, d) {
              return a + d.actualMinutes;
            }, 0) / elapsed.length
          )
        : 0;

      var studied = elapsed.filter(function (d) {
        return d.actualMinutes > 0;
      });
      agg.bestDay = studied.length
        ? studied.slice().sort(function (a, b) {
            return b.actualMinutes - a.actualMinutes;
          })[0]
        : null;
      agg.weakestDay = studied.length
        ? studied.slice().sort(function (a, b) {
            return a.actualMinutes - b.actualMinutes;
          })[0]
        : null;

      agg.reflection = state.student.weeklyReflections[weekId] || null;
      agg.consultantFeedback = state.consultant.feedback[weekId] || null;
      agg.exams = Q.examsInWeek(weekId, state).map(function (e) {
        return S.examStats(e.id, state);
      });

      agg.skipped = allTaskStats.filter(function (t) {
        return t.isSkipped;
      });
      agg.skipReasons = countSkipReasons(agg.skipped);
      return agg;
    });
  };

  function countSkipReasons(skippedList) {
    var map = {};
    skippedList.forEach(function (ts) {
      var r = ts.skipReason || "other";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.keys(map)
      .map(function (k) {
        return { id: k, label: util.skipReasonLabel(k), count: map[k] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  S.countSkipReasons = countSkipReasons;

  /**
   * Subject progress for the radar/table.
   * Metric (stated in the UI): actual study minutes / planned study minutes.
   */
  S.subjectStats = function (scope, id, st) {
    var state = st || HDML.store.get();
    if (scope === "day") {
      var ds = S.dayStats(id, state);
      return ds ? ds.bySubject : [];
    }
    if (scope === "week") {
      var ws = S.weekStats(id, state);
      return ws ? ws.bySubject : [];
    }
    return memo("subjects:all", function () {
      var list = util.values(state.consultant.tasks).map(function (t) {
        return S.taskStats(t, state);
      });
      return bySubject(list, state);
    });
  };

  /** Radar rows: every active subject appears, even with zero planned time. */
  S.subjectRadar = function (weekId, st) {
    var state = st || HDML.store.get();
    var rows = S.subjectStats("week", weekId, state);
    var byId = {};
    rows.forEach(function (r) {
      byId[r.subjectId] = r;
    });
    return Q.activeSubjects(state)
      .map(function (s) {
        var r = byId[s.id];
        return {
          subjectId: s.id,
          name: s.name,
          color: s.color,
          plannedMinutes: r ? r.plannedMinutes : 0,
          actualMinutes: r ? r.actualMinutes : 0,
          value: r && r.studyAchievementRate !== null ? Math.min(100, r.studyAchievementRate) : 0,
          applicable: !!(r && r.plannedMinutes > 0)
        };
      })
      .filter(function (r) {
        return r.applicable || r.actualMinutes > 0;
      });
  };

  /**
   * Daily actual study minutes across every day that exists in the plan,
   * ordered by date. Spans weeks, exactly as the sketch asks
   * ("در هفته‌های جدید، روزهای هفته قبل هم ثبت می‌شود").
   */
  S.trend = function (options, st) {
    var opts = options || {};
    return memo("trend:" + (opts.weekId || "all") + ":" + (opts.limit || 0), function () {
      var state = st || HDML.store.get();
      var days = util.values(state.consultant.days);
      if (opts.weekId) {
        days = days.filter(function (d) {
          return d.weekId === opts.weekId;
        });
      }
      days.sort(function (a, b) {
        return D.compare(a.date, b.date);
      });
      if (opts.limit && days.length > opts.limit) {
        days = days.slice(days.length - opts.limit);
      }
      var today = D.today();
      return days.map(function (d) {
        var ds = S.dayStats(d.id, state);
        return {
          dayId: d.id,
          date: d.date,
          label: D.format(d.date, "short"),
          dayName: D.WEEK_DAYS_SHORT[d.dowIndex],
          plannedMinutes: ds ? ds.plannedMinutes : 0,
          actualMinutes: ds ? ds.actualMinutes : 0,
          isFuture: d.date > today
        };
      });
    });
  };

  /** True once there is more than one day with recorded study time. */
  S.hasTrendData = function (series) {
    return (
      series.filter(function (p) {
        return p.actualMinutes > 0;
      }).length >= 2
    );
  };

  /**
   * Konkur percentage: ((3 x correct) - wrong) / (3 x total) x 100.
   * Blank answers cost nothing; a wrong answer cancels a third of a right one.
   * Can legitimately be negative.
   */
  S.konkurPercentage = function (correct, wrong, total) {
    if (!total) return null;
    return util.round(((3 * correct - wrong) / (3 * total)) * 100, 1);
  };

  S.subjectResultPercentage = function (entry, scoreMode) {
    if (!entry) return null;
    if (scoreMode === "score20") {
      if (entry.score === null || entry.score === undefined || entry.score === "")
        return null;
      return util.round((Number(entry.score) / 20) * 100, 1);
    }
    var total = util.toInt(entry.totalQuestions, 0);
    if (total > 0) {
      return S.konkurPercentage(
        util.toInt(entry.correct, 0),
        util.toInt(entry.wrong, 0),
        total
      );
    }
    if (entry.percentage === null || entry.percentage === undefined || entry.percentage === "")
      return null;
    return util.round(Number(entry.percentage), 1);
  };

  S.examStats = function (examId, st) {
    var state = st || HDML.store.get();
    var exam = state.consultant.exams[examId];
    if (!exam) return null;
    var result = state.student.examResults[examId] || null;
    var scoreMode = exam.scoreMode === "score20" ? "score20" : "percentage";

    var subjectRows = (exam.subjectIds || []).map(function (sid) {
      var entry =
        (result &&
          (result.subjectResults || []).filter(function (r) {
            return r.subjectId === sid;
          })[0]) ||
        null;
      var pct = S.subjectResultPercentage(entry, scoreMode);
      var correct = entry ? util.toInt(entry.correct, 0) : 0;
      var wrong = entry ? util.toInt(entry.wrong, 0) : 0;
      var unanswered = entry ? util.toInt(entry.unanswered, 0) : 0;
      var total = entry ? util.toInt(entry.totalQuestions, 0) : 0;
      return {
        subjectId: sid,
        name: Q.subjectName(sid, state),
        color: Q.subjectColor(sid, state),
        correct: correct,
        wrong: wrong,
        unanswered: unanswered,
        totalQuestions: total,
        score: entry && entry.score !== undefined ? entry.score : null,
        percentage: pct,
        hasData: pct !== null
      };
    });

    var withData = subjectRows.filter(function (r) {
      return r.hasData;
    });

    /* Weighted by question count when available, otherwise a plain mean. */
    var overall = null;
    if (withData.length) {
      var weighted = withData.filter(function (r) {
        return r.totalQuestions > 0;
      });
      if (weighted.length === withData.length && scoreMode !== "score20") {
        var totQ = weighted.reduce(function (a, r) {
          return a + r.totalQuestions;
        }, 0);
        var totC = weighted.reduce(function (a, r) {
          return a + r.correct;
        }, 0);
        var totW = weighted.reduce(function (a, r) {
          return a + r.wrong;
        }, 0);
        overall = S.konkurPercentage(totC, totW, totQ);
      } else {
        overall =
          util.round(
            withData.reduce(function (a, r) {
              return a + r.percentage;
            }, 0) / withData.length,
            1
          );
      }
    }

    if (
      result &&
      result.overallPercentageOverride !== null &&
      result.overallPercentageOverride !== undefined &&
      result.overallPercentageOverride !== ""
    ) {
      overall = util.round(Number(result.overallPercentageOverride), 1);
    }

    var totals = withData.reduce(
      function (acc, r) {
        acc.correct += r.correct;
        acc.wrong += r.wrong;
        acc.unanswered += r.unanswered;
        acc.totalQuestions += r.totalQuestions;
        return acc;
      },
      { correct: 0, wrong: 0, unanswered: 0, totalQuestions: 0 }
    );

    var best = null;
    var worst = null;
    if (withData.length) {
      var sorted = withData.slice().sort(function (a, b) {
        return b.percentage - a.percentage;
      });
      best = sorted[0];
      worst = sorted[sorted.length - 1];
    }

    return {
      examId: examId,
      exam: exam,
      result: result,
      scoreMode: scoreMode,
      taken: !!(result && result.taken),
      hasResult: withData.length > 0,
      isUpcoming: exam.date > D.today() && !(result && result.taken),
      date: exam.date,
      name: exam.name,
      subjectRows: subjectRows,
      overallPercentage: overall,
      taraz:
        result && result.taraz !== "" && result.taraz !== undefined
          ? result.taraz
          : null,
      rank: result && result.rank !== "" ? result.rank : null,
      totalParticipants: result ? result.totalParticipants : null,
      totals: totals,
      best: best,
      worst: worst,
      targetPercentage:
        exam.targetPercentage === "" || exam.targetPercentage === null
          ? null
          : Number(exam.targetPercentage),
      analysis: (result && result.analysis) || null,
      studentNote: (result && result.studentNote) || "",
      consultantNote: exam.consultantNote || ""
    };
  };

  S.allExamStats = function (st) {
    return memo("exams:all", function () {
      var state = st || HDML.store.get();
      return Q.examsSorted(state)
        .map(function (e) {
          return S.examStats(e.id, state);
        })
        .filter(Boolean);
    });
  };

  /** Overall-percentage series for the exam trend chart. */
  S.examTrend = function (st) {
    return S.allExamStats(st)
      .filter(function (e) {
        return e.hasResult && e.overallPercentage !== null;
      })
      .map(function (e) {
        return {
          examId: e.examId,
          label: e.name,
          date: e.date,
          value: e.overallPercentage
        };
      });
  };

  /** Per-subject exam trend: subjectId -> [{date, value}]. */
  S.examSubjectTrend = function (st) {
    var series = {};
    S.allExamStats(st)
      .filter(function (e) {
        return e.hasResult;
      })
      .forEach(function (e) {
        e.subjectRows.forEach(function (r) {
          if (!r.hasData) return;
          (series[r.subjectId] = series[r.subjectId] || {
            subjectId: r.subjectId,
            name: r.name,
            color: r.color,
            points: []
          }).points.push({ date: e.date, label: e.name, value: r.percentage });
        });
      });
    return Object.keys(series).map(function (k) {
      return series[k];
    });
  };

  /** Is there enough real data to draw anything meaningful? */
  S.hasAnyActivity = function (st) {
    var state = st || HDML.store.get();
    var logs = state.student.taskLogs;
    var ids = Object.keys(logs);
    for (var i = 0; i < ids.length; i++) {
      var l = logs[ids[i]];
      if (
        l.status === HDML.TASK_STATUS.COMPLETED ||
        l.status === HDML.TASK_STATUS.SKIPPED ||
        (l.actualMinutes !== null && l.actualMinutes > 0)
      ) {
        return true;
      }
    }
    return false;
  };
})(typeof window !== "undefined" ? window : globalThis);
