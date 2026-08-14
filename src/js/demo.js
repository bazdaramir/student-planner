/* ==========================================================================
   demo.js - a realistic demo student so the whole UI can be evaluated

   Clearly marked with meta.isDemo, and removable from Settings. No view ever
   invents numbers: the demo writes real task logs and everything else is
   derived from them exactly as it would be for a real student.
   ========================================================================== */
(function (global) {
  "use strict";

  var HDML = global.HDML;
  var util = HDML.util;
  var D = HDML.date;

  var DEMO = (HDML.demo = {});

  /* Deterministic pseudo-random so the demo looks the same every time. */
  function seeded(seed) {
    var s = seed;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }

  var PLANS = {
    "زیست‌شناسی": [
      ["فصل ۵ — تنظیم عصبی", "مطالعه‌ی درسنامه", "study", 75, 0],
      ["تست تنظیم عصبی", "حل ۳۰ تست", "practice", 90, 30],
      ["دوره‌ی فصل ۴", "مرور سریع", "review", 45, 0],
      ["ژنتیک جمعیت", "مطالعه و حل مثال", "study", 80, 0]
    ],
    "شیمی": [
      ["استوکیومتری", "حل تمرین‌های کتاب", "practice", 70, 25],
      ["پیوند یونی", "مطالعه‌ی درسنامه", "study", 60, 0],
      ["تست ترکیبی شیمی ۲", "حل ۲۵ تست", "practice", 75, 25]
    ],
    "فیزیک": [
      ["حرکت‌شناسی", "مرور و حل مسئله", "review", 60, 0],
      ["تست دینامیک", "حل ۲۰ تست", "practice", 80, 20],
      ["نوسان و موج", "مطالعه‌ی درسنامه", "study", 70, 0]
    ],
    "ریاضی": [
      ["مشتق", "خواندن درسنامه", "study", 60, 0],
      ["تست مشتق", "حل ۳۰ تست", "practice", 90, 30],
      ["حد و پیوستگی", "رفع اشکال", "review", 45, 0],
      ["هندسه‌ی تحلیلی", "حل تمرین", "practice", 70, 20]
    ],
    "ادبیات": [
      ["آرایه‌های ادبی", "مطالعه و تست", "practice", 45, 20],
      ["قرابت معنایی", "حل ۲۵ تست", "practice", 50, 25]
    ],
    "عربی": [["ترجمه و تعریب", "مطالعه و تمرین", "study", 40, 15]],
    "دینی": [["درس ۶", "مطالعه و تست", "practice", 40, 20]],
    "زبان انگلیسی": [["واژگان درس ۳", "حفظ و تست", "practice", 35, 15]],
    "زمین‌شناسی": [["منابع آب", "مطالعه‌ی درسنامه", "study", 35, 0]]
  };

  /** Replaces all state with the demo dataset. */
  DEMO.load = function () {
    var rand = seeded(20260814);
    var state = HDML.defaultState();

    state.meta.isDemo = true;
    state.consultant.student = {
      id: "stu_demo",
      firstName: "دانش‌آموز",
      lastName: "نمونه",
      nationalId: "",
      grade: "دوازدهم",
      track: "tajrobi",
      goal: "پزشکی — دانشگاه علوم پزشکی تهران",
      consultantName: "مشاور نمونه"
    };

    HDML.DEFAULT_SUBJECTS.tajrobi.forEach(function (name, i) {
      state.consultant.subjects.push({
        id: "sub_demo_" + i,
        name: name,
        color: util.subjectColor(i),
        order: i,
        archived: false
      });
    });

    function subjectId(name) {
      var found = state.consultant.subjects.filter(function (s) {
        return s.name === name;
      })[0];
      return found ? found.id : state.consultant.subjects[0].id;
    }

    var thisWeekStart = D.weekStart(D.today());
    var lastWeekStart = D.addDays(thisWeekStart, -7);
    var today = D.today();

    var weekDefs = [
      { start: lastWeekStart, title: "هفته ۳", index: 3, id: "wk_demo_1" },
      { start: thisWeekStart, title: "هفته ۴", index: 4, id: "wk_demo_2" }
    ];

    var subjectNames = Object.keys(PLANS);
    var taskCounter = 0;

    weekDefs.forEach(function (def, weekIdx) {
      state.consultant.weeks[def.id] = {
        id: def.id,
        index: def.index,
        title: def.title,
        startDate: def.start,
        endDate: D.addDays(def.start, 6),
        locked: weekIdx === 0,
        consultantNote:
          weekIdx === 0
            ? "تمرکز این هفته روی جبران عقب‌ماندگی زیست و افزایش تعداد تست شیمی است."
            : "پس از آزمون این هفته، حتماً تحلیل آزمون را کامل بنویس. تعداد تست فیزیک را نسبت به هفته‌ی قبل بیشتر کرده‌ام.",
        createdAt: D.now()
      };

      D.weekDates(def.start).forEach(function (iso, dowIndex) {
        var dayId = "day_demo_" + weekIdx + "_" + dowIndex;
        state.consultant.days[dayId] = {
          id: dayId,
          weekId: def.id,
          date: iso,
          dowIndex: dowIndex,
          consultantNote:
            dowIndex === 6
              ? "جمعه سبک‌تر برنامه‌ریزی شده است؛ از این روز برای دوره و استراحت استفاده کن."
              : ""
        };

        /* Friday is a light day; the rest carry 4-7 tasks. */
        var taskCount = dowIndex === 6 ? 3 : 4 + Math.floor(rand() * 4);
        var used = {};

        for (var i = 0; i < taskCount; i++) {
          var name = subjectNames[Math.floor(rand() * subjectNames.length)];
          var options = PLANS[name];
          var pick = options[Math.floor(rand() * options.length)];
          var key = name + "|" + pick[0];
          if (used[key]) continue;
          used[key] = true;

          var taskId = "tsk_demo_" + taskCounter++;
          state.consultant.tasks[taskId] = {
            id: taskId,
            dayId: dayId,
            subjectId: subjectId(name),
            topic: pick[0],
            title: pick[1] + " — " + pick[0],
            description: "",
            type: pick[2],
            plannedMinutes: pick[3],
            startTime: "",
            targetQuestions: pick[4],
            priority: i === 0 ? "high" : rand() > 0.8 ? "low" : "normal",
            consultantNote:
              i === 0 && dowIndex < 2
                ? "این فعالیت را حتماً اول صبح انجام بده؛ بیشترین تمرکز را همان موقع داری."
                : "",
            order: i,
            createdAt: D.now()
          };
        }
      });
    });

    Object.keys(state.consultant.tasks).forEach(function (taskId) {
      var task = state.consultant.tasks[taskId];
      var day = state.consultant.days[task.dayId];
      if (day.date > today) return; /* future days stay untouched */

      var roll = rand();
      var isPastWeek = day.weekId === "wk_demo_1";
      var skipChance = isPastWeek ? 0.12 : 0.16;

      if (roll < skipChance) {
        state.student.taskLogs[taskId] = {
          taskId: taskId,
          status: "skipped",
          actualMinutes: null,
          timeSource: "none",
          questions: null,
          note: "",
          skipReason: ["no_time", "fatigue", "overload", "difficulty", "focus"][
            Math.floor(rand() * 5)
          ],
          skipNote: "",
          completedAt: null,
          updatedAt: D.now()
        };
        return;
      }

      /* A couple of tasks are left pending on today itself. */
      if (day.date === today && roll > 0.72) return;

      var ratio = 0.68 + rand() * 0.5;
      var actual = Math.round(task.plannedMinutes * ratio);
      /* One in eight completions has no recorded time -> "estimated". */
      var recordTime = rand() > 0.12;

      var questions = null;
      if (task.targetQuestions > 0) {
        var completedQ = Math.round(
          task.targetQuestions * (0.6 + rand() * 0.45)
        );
        completedQ = Math.min(completedQ, task.targetQuestions);
        var correct = Math.round(completedQ * (0.5 + rand() * 0.38));
        var unanswered = Math.round((completedQ - correct) * rand() * 0.5);
        var wrong = completedQ - correct - unanswered;
        questions = {
          completed: completedQ,
          correct: correct,
          wrong: Math.max(0, wrong),
          unanswered: unanswered
        };
      }

      state.student.taskLogs[taskId] = {
        taskId: taskId,
        status: "completed",
        actualMinutes: recordTime ? actual : null,
        timeSource: recordTime ? "actual" : "estimated",
        questions: questions,
        note: rand() > 0.85 ? "این مبحث نیاز به دوره‌ی دوباره دارد." : "",
        skipReason: null,
        skipNote: "",
        completedAt: day.date + "T20:00:00.000Z",
        updatedAt: D.now()
      };
    });

    var noteTexts = [
      "صبح تمرکز خوبی داشتم، بعدازظهر افت کردم.",
      "تست‌های شیمی سخت‌تر از انتظارم بود؛ وقت بیشتری گرفت.",
      "امروز طبق برنامه پیش رفتم و از نتیجه راضی‌ام.",
      "خواب کافی نداشتم و بازدهی‌ام پایین بود.",
      "دوره‌ی زیست خیلی مفید بود؛ مطالب جا افتاد."
    ];
    Object.keys(state.consultant.days).forEach(function (dayId, i) {
      var day = state.consultant.days[dayId];
      if (day.date > today) return;
      if (i % 2 === 0) {
        state.student.dailyNotes[dayId] = {
          note: noteTexts[i % noteTexts.length],
          updatedAt: D.now()
        };
      }
    });

    state.student.weeklyReflections["wk_demo_1"] = {
      wentWell: "تعداد تست زیست را نسبت به هفته‌ی قبل بیشتر کردم و نظم صبح‌ها بهتر شد.",
      difficult: "شیمی همچنان کند پیش می‌رود و وقت‌گیر است.",
      improve: "هفته‌ی بعد شیمی را زودتر در روز شروع می‌کنم و تست‌های زمان‌دار می‌زنم.",
      updatedAt: D.now()
    };

    state.consultant.feedback["wk_demo_1"] = {
      text:
        "عملکرد کلی مثبت بود. زمان مطالعه‌ی شیمی از برنامه عقب است؛ در هفته‌ی جدید بازه‌ی شیمی را به صبح منتقل کردم. روی تست زمان‌دار تمرکز کن.",
      at: D.now()
    };

    var examSubjects = ["زیست‌شناسی", "شیمی", "فیزیک", "ریاضی", "ادبیات"].map(subjectId);

    var examDefs = [
      {
        id: "exm_demo_1",
        name: "آزمون آزمایشی ۲",
        date: D.addDays(thisWeekStart, -21),
        pcts: [58, 41, 47, 39, 62],
        rank: 3120
      },
      {
        id: "exm_demo_2",
        name: "آزمون آزمایشی ۳",
        date: D.addDays(thisWeekStart, -7),
        pcts: [67, 52, 55, 46, 68],
        rank: 2260
      },
      {
        id: "exm_demo_3",
        name: "آزمون آزمایشی ۴",
        date: D.addDays(thisWeekStart, 5),
        pcts: null,
        rank: null
      }
    ];

    examDefs.forEach(function (def) {
      state.consultant.exams[def.id] = {
        id: def.id,
        name: def.name,
        date: def.date,
        type: "mock",
        scoreMode: "percentage",
        subjectIds: examSubjects,
        targetPercentage: 65,
        consultantNote:
          def.pcts === null
            ? "برای این آزمون حتماً بخش ژنتیک را مرور کن."
            : "",
        createdAt: D.now()
      };

      if (!def.pcts) return;

      /* Build counts that actually produce the intended Konkur percentage. */
      var subjectResults = examSubjects.map(function (sid, i) {
        var total = [50, 35, 45, 40, 25][i];
        var target = def.pcts[i];
        /* pct = (3c - w) / (3 total) * 100  ->  choose c, derive w. */
        var correct = Math.round((target / 100) * total * 0.92);
        var raw = (target / 100) * 3 * total;
        var wrong = Math.max(0, Math.round(3 * correct - raw));
        wrong = Math.min(wrong, total - correct);
        var unanswered = total - correct - wrong;
        return {
          subjectId: sid,
          totalQuestions: total,
          correct: correct,
          wrong: wrong,
          unanswered: Math.max(0, unanswered),
          score: null,
          percentage: null
        };
      });

      state.student.examResults[def.id] = {
        examId: def.id,
        taken: true,
        rank: def.rank,
        totalParticipants: 42000,
        overallPercentageOverride: null,
        subjectResults: subjectResults,
        analysis: {
          good: "مدیریت زمان در زیست بهتر از آزمون قبل بود.",
          bad: "در ریاضی چند تست ساده را از دست دادم.",
          mistakes: "بی‌دقتی در محاسبات شیمی و جاماندن از وقت در فیزیک.",
          review: "ژنتیک، استوکیومتری، دینامیک",
          time: "۱۰ دقیقه از وقت عمومی را در ادبیات هدر دادم."
        },
        studentNote: "روند صعودی است اما هنوز با درصد هدف فاصله دارم.",
        updatedAt: D.now()
      };
    });

    state.ui.currentWeekId = "wk_demo_2";
    state.ui.view = "dashboard";
    state.meta.planStamp = D.now();

    HDML.store.replace(state);
    return state;
  };
})(typeof window !== "undefined" ? window : globalThis);
