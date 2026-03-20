import React, { useState, useEffect, useRef } from "react";
import {
  Clock,
  BookOpen,
  ChevronRight,
  AlertCircle,
  CalendarDays,
  Calculator,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  BookMarked,
  StickyNote,
  LogOut,
  Home,
  Settings,
  Users,
  Shield,
  Info,
  X,
  Trophy,
  Check,
} from "lucide-react";
import { motion } from "motion/react";
import {
  db,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  orderBy,
  limit,
  deleteField,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "./firebase";
import { handleFirestoreError, OperationType } from "./firestore-error";

const anchorDate = new Date(2026, 2, 16); // March 16, 2026

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

function getABDay(targetDate: Date) {
  let days = 0;
  let current = new Date(anchorDate);
  current.setHours(0, 0, 0, 0);
  let target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  if (target < current) {
    let temp = new Date(target);
    while (temp < current) {
      if (temp.getDay() !== 0 && temp.getDay() !== 6) days--;
      temp.setDate(temp.getDate() + 1);
    }
  } else {
    let temp = new Date(current);
    while (temp < target) {
      if (temp.getDay() !== 0 && temp.getDay() !== 6) days++;
      temp.setDate(temp.getDate() + 1);
    }
  }

  return Math.abs(days) % 2 === 0 ? "B" : "A";
}

function getDayType(date: Date) {
  const day = date.getDay();
  if (day === 1) return "Wildcat";
  if (day === 2) return "Even";
  if (day === 3) return "Odd";
  if (day === 4) return "Wildcat";
  if (day === 5) return "Wildcat";
  return "Weekend";
}

const defaultClasses: Record<string, string> = {
  "1": "Period 1",
  "2": "Period 2",
  "3A": "Period 3 (A)",
  "3B": "Period 3 (B)",
  "4A": "Period 4 (A)",
  "4B": "Period 4 (B)",
  "5": "Period 5",
  "6": "Period 6",
  "7": "Period 7",
  "8": "Period 8",
  HR: "Homeroom",
  ADV: "Advisory / Library",
  Lunch: "Lunch",
};

type ScheduleBlock = {
  period: string;
  start: string;
  end: string;
  isPassing?: boolean;
  name?: string;
};

const schedules: Record<string, ScheduleBlock[]> = {
  Wildcat: [
    { period: "HR", start: "07:30", end: "07:40" },
    { period: "1", start: "07:40", end: "08:25" },
    { period: "2", start: "08:25", end: "09:10" },
    { period: "3", start: "09:10", end: "09:55" },
    { period: "4", start: "09:55", end: "10:40" },
    { period: "ADV", start: "10:40", end: "10:55" },
    { period: "5", start: "10:55", end: "11:40" },
    { period: "Lunch", start: "11:40", end: "12:05" },
    { period: "6", start: "12:05", end: "12:50" },
    { period: "7", start: "12:50", end: "13:35" },
    { period: "8", start: "13:35", end: "14:20" },
  ],
  Odd: [
    { period: "HR", start: "07:30", end: "07:40" },
    { period: "1", start: "07:40", end: "09:10" },
    { period: "3", start: "09:10", end: "09:55" },
    { period: "4", start: "09:55", end: "10:40" },
    { period: "ADV", start: "10:40", end: "10:55" },
    { period: "5", start: "10:55", end: "12:25" },
    { period: "Lunch", start: "12:25", end: "12:50" },
    { period: "7", start: "12:50", end: "14:20" },
  ],
  Even: [
    { period: "HR", start: "07:30", end: "07:40" },
    { period: "2", start: "07:40", end: "09:10" },
    { period: "3", start: "09:10", end: "09:55" },
    { period: "4", start: "09:55", end: "10:40" },
    { period: "ADV", start: "10:40", end: "10:55" },
    { period: "6", start: "10:55", end: "12:25" },
    { period: "Lunch", start: "12:25", end: "12:50" },
    { period: "8", start: "12:50", end: "14:20" },
  ],
};

function parseTime(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function getClassName(
  period: string | undefined,
  abDay: string,
  userClasses: Record<string, string>,
) {
  if (!period) return "";
  if (period === "Passing") return "Passing Period";
  if (period === "Before School") return "Before School";
  if (period === "Done") return "School is over!";
  if (["1", "2", "3", "4", "5", "6", "7", "8"].includes(period)) {
    return userClasses[`${period}${abDay}`] || userClasses[period] || period;
  }
  return userClasses[period] || period;
}

function format12Hour(timeStr: string) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

function formatTimeRemaining(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type HomeworkItem = {
  id: string;
  text: string;
  dueDate: string;
  showOnMain: boolean;
  completed: boolean;
  userId?: string;
};

function HomeworkTab({
  homework,
  setHomework,
  user,
  currentTheme,
}: {
  homework: HomeworkItem[];
  setHomework: React.Dispatch<React.SetStateAction<HomeworkItem[]>>;
  user: string | null;
  currentTheme: any;
}) {
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [showOnMain, setShowOnMain] = useState(true);

  const addHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    const newItem: HomeworkItem = {
      id: Date.now().toString(),
      text: newTask,
      dueDate: newDueDate,
      showOnMain,
      completed: false,
      userId: user || undefined,
    };

    if (user) {
      try {
        await setDoc(doc(db, "users", user, "homework", newItem.id), newItem);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `users/${user}/homework/${newItem.id}`,
        );
      }
    } else {
      setHomework([...homework, newItem]);
    }

    setNewTask("");
    setNewDueDate("");
  };

  const toggleComplete = async (id: string) => {
    const item = homework.find((h) => h.id === id);
    if (!item) return;

    if (user) {
      try {
        await updateDoc(doc(db, "users", user, "homework", id), {
          completed: !item.completed,
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${user}/homework/${id}`,
        );
      }
    } else {
      setHomework(
        homework.map((h) =>
          h.id === id ? { ...h, completed: !h.completed } : h,
        ),
      );
    }
  };

  const toggleShowOnMain = async (id: string) => {
    const item = homework.find((h) => h.id === id);
    if (!item) return;

    if (user) {
      try {
        await updateDoc(doc(db, "users", user, "homework", id), {
          showOnMain: !item.showOnMain,
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${user}/homework/${id}`,
        );
      }
    } else {
      setHomework(
        homework.map((h) =>
          h.id === id ? { ...h, showOnMain: !h.showOnMain } : h,
        ),
      );
    }
  };

  const removeHomework = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user, "homework", id));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${user}/homework/${id}`,
        );
      }
    } else {
      setHomework(homework.filter((h) => h.id !== id));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <BookMarked className="text-amber-400" />
        Homework Tracker
      </h2>

      <form
        onSubmit={addHomework}
        className={`bg-black/40 p-4 rounded-2xl border ${currentTheme.border} mb-8 space-y-4`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-white/60 mb-1">
              Assignment
            </label>
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="e.g. Read chapter 4"
              className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-2 text-white focus:outline-none focus:border-white/50 transition-colors`}
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-white/60 mb-1">
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-2 text-white focus:outline-none focus:border-white/50 transition-colors`}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className={`w-full ${currentTheme.button} ${currentTheme.buttonHover} text-white font-medium py-2 px-4 rounded-xl transition-colors flex items-center justify-center gap-2`}
            >
              <Plus size={18} /> Add
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showOnMain"
            checked={showOnMain}
            onChange={(e) => setShowOnMain(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 text-white focus:ring-white/50 bg-black/40"
          />
          <label htmlFor="showOnMain" className="text-sm text-white/80">
            Show on main schedule page
          </label>
        </div>
      </form>

      <div className="space-y-3">
        {homework.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            No homework added yet!
          </div>
        ) : (
          homework.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${item.completed ? `bg-black/20 border-transparent` : `bg-black/40 ${currentTheme.border}`}`}
            >
              <div className="flex items-center gap-4 flex-1">
                <button
                  onClick={() => toggleComplete(item.id)}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  {item.completed ? (
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  ) : (
                    <Circle size={24} />
                  )}
                </button>
                <div
                  className={item.completed ? "opacity-50 line-through" : ""}
                >
                  <div className="text-white font-medium">{item.text}</div>
                  {item.dueDate && (
                    <div className="text-xs text-white/60 mt-1">
                      Due: {new Date(item.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleShowOnMain(item.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${item.showOnMain ? "bg-white/20 text-white border-white/30" : "bg-black/40 text-white/60 border-white/10"}`}
                  title="Toggle visibility on main page"
                >
                  {item.showOnMain ? "Visible on Main" : "Hidden on Main"}
                </button>
                <button
                  onClick={() => removeHomework(item.id)}
                  className="p-2 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

function GradeCalculator({ currentTheme }: { currentTheme: any }) {
  const [currentGrade, setCurrentGrade] = useState(
    () => localStorage.getItem("school_day_current_grade") || "",
  );
  const [includeCurrentGrade, setIncludeCurrentGrade] = useState(
    () => localStorage.getItem("school_day_include_current") === "true",
  );
  const [showHelp, setShowHelp] = useState(false);

  const [assignments, setAssignments] = useState(() => {
    const saved = localStorage.getItem("school_day_assignments");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: 1, name: "Homework 1", grade: "95", weight: "20" },
      { id: 2, name: "Test 1", grade: "88", weight: "50" },
      { id: 3, name: "Quiz 1", grade: "90", weight: "30" },
    ];
  });

  useEffect(() => {
    localStorage.setItem("school_day_assignments", JSON.stringify(assignments));
    localStorage.setItem("school_day_current_grade", currentGrade);
    localStorage.setItem(
      "school_day_include_current",
      includeCurrentGrade.toString(),
    );
  }, [assignments, currentGrade, includeCurrentGrade]);

  const addRow = () =>
    setAssignments([
      ...assignments,
      { id: Date.now(), name: "", grade: "", weight: "" },
    ]);

  const updateRow = (id: number, field: string, value: string) => {
    setAssignments(
      assignments.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    );
  };

  const removeRow = (id: number) => {
    setAssignments(assignments.filter((a) => a.id !== id));
  };

  let totalWeight = 0;
  let earned = 0;

  if (includeCurrentGrade && currentGrade) {
    const cg = parseFloat(currentGrade);
    if (!isNaN(cg)) {
      // If including current grade, we assume the current grade is worth 100% of the weight so far,
      // and assignments are added on top of it.
      // Wait, a better way: current grade is the base.
      // Let's assume current grade is worth 100 - (sum of new assignment weights).
      let newAssignmentsWeight = 0;
      assignments.forEach((a) => {
        const w = parseFloat(a.weight);
        if (!isNaN(w)) newAssignmentsWeight += w;
      });

      const remainingWeight = Math.max(0, 100 - newAssignmentsWeight);
      earned += cg * remainingWeight;
      totalWeight += remainingWeight;
    }
  }

  assignments.forEach((a) => {
    const g = parseFloat(a.grade);
    const w = parseFloat(a.weight);
    if (!isNaN(g) && !isNaN(w)) {
      earned += g * w;
      totalWeight += w;
    }
  });

  const finalGrade =
    totalWeight > 0 ? (earned / totalWeight).toFixed(2) : "0.00";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calculator className="text-white/80" />
          Grade Calculator
        </h2>
        <div
          className={`bg-black/40 border ${currentTheme.border} px-6 py-3 rounded-2xl text-center w-full sm:w-auto`}
        >
          <div className="text-sm text-white/80 font-medium mb-1">
            Final Grade
          </div>
          <div className="text-4xl font-bold text-white">{finalGrade}%</div>
        </div>
      </div>

      <div
        className={`bg-black/40 border ${currentTheme.border} p-4 rounded-2xl mb-8`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-medium">Current Grade (Optional)</h3>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <AlertCircle size={16} />
            </button>
          </div>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={includeCurrentGrade}
                onChange={() => setIncludeCurrentGrade(!includeCurrentGrade)}
              />
              <div
                className={`block w-14 h-8 rounded-full transition-colors ${includeCurrentGrade ? "bg-emerald-500" : "bg-slate-600"}`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${includeCurrentGrade ? "transform translate-x-6" : ""}`}
              ></div>
            </div>
          </label>
        </div>

        {showHelp && (
          <div className="mb-4 p-3 bg-blue-500/20 text-blue-200 text-sm rounded-xl border border-blue-500/30">
            Turn this switch on to see how new assignments affect your current
            grade. Your current grade will be treated as the base (worth 100%
            minus the weight of new assignments).
          </div>
        )}

        <div className="flex items-center gap-4">
          <input
            type="number"
            value={currentGrade}
            onChange={(e) => setCurrentGrade(e.target.value)}
            placeholder="e.g. 85"
            disabled={!includeCurrentGrade}
            className={`w-full sm:w-1/3 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors ${!includeCurrentGrade ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          <span className="text-white/60">%</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-2 sm:gap-4 text-xs sm:text-sm font-medium text-white/60 px-2">
          <div className="col-span-5">Assignment / Category</div>
          <div className="col-span-3">Grade (%)</div>
          <div className="col-span-3">Weight (%)</div>
          <div className="col-span-1"></div>
        </div>

        {assignments.map((a: any) => (
          <div
            key={a.id}
            className="grid grid-cols-12 gap-2 sm:gap-4 items-center"
          >
            <div className="col-span-5">
              <input
                type="text"
                value={a.name}
                onChange={(e) => updateRow(a.id, "name", e.target.value)}
                placeholder="e.g. Test 1"
                className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:border-white/50 transition-colors text-sm sm:text-base`}
              />
            </div>
            <div className="col-span-3">
              <input
                type="number"
                value={a.grade}
                onChange={(e) => updateRow(a.id, "grade", e.target.value)}
                placeholder="95"
                className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:border-white/50 transition-colors text-sm sm:text-base`}
              />
            </div>
            <div className="col-span-3">
              <input
                type="number"
                value={a.weight}
                onChange={(e) => updateRow(a.id, "weight", e.target.value)}
                placeholder="20"
                className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white focus:outline-none focus:border-white/50 transition-colors text-sm sm:text-base`}
              />
            </div>
            <div className="col-span-1 flex justify-center">
              <button
                onClick={() => removeRow(a.id)}
                className="p-2 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-6 flex items-center gap-2 text-white/80 hover:text-white font-medium px-4 py-2 rounded-xl hover:bg-white/10 transition-colors"
      >
        <Plus size={20} /> Add Row
      </button>
    </motion.div>
  );
}

interface Note {
  id: string;
  text: string;
  color: string;
  userId?: string;
  showOnMain?: boolean;
  completed?: boolean;
}

interface UserProfile {
  displayName: string;
  classes: Record<string, string>;
  theme?: string;
  isOnline?: boolean;
  lastActive?: number;
  timeSpent?: number;
  roleId?: string;
  proDayUnlocked?: boolean;
  proDayActive?: boolean;
  proDayName?: string;
  profilePictureUrl?: string;
  profileColor?: string;
  profileBadge?: string;
  namePlate?: string;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface CommunityPost {
  id: string;
  heading: string;
  text: string;
  imageUrl?: string;
  soundUrl?: string;
  authorId: string;
  authorName: string;
  authorRoleName?: string;
  createdAt: any;
  likes?: string[];
  comments?: {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: any;
  }[];
}

function StickyNotesTab({
  user,
  notes,
  setNotes,
  currentTheme,
}: {
  user: string | null;
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  currentTheme: any;
}) {
  const [newNoteText, setNewNoteText] = useState("");
  const [selectedColor, setSelectedColor] = useState("bg-yellow-200");
  const [showOnMain, setShowOnMain] = useState(true);

  const colors = [
    "bg-yellow-200",
    "bg-pink-200",
    "bg-blue-200",
    "bg-green-200",
    "bg-purple-200",
  ];

  const addNote = async () => {
    if (!newNoteText.trim()) return;
    const newNote: Note = {
      id: Date.now().toString(),
      text: newNoteText,
      color: selectedColor,
      showOnMain,
      userId: user || undefined,
    };

    if (user) {
      try {
        await setDoc(doc(db, "users", user, "notes", newNote.id), newNote);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `users/${user}/notes/${newNote.id}`,
        );
      }
    } else {
      setNotes([...notes, newNote]);
    }
    setNewNoteText("");
  };

  const deleteNote = async (id: string) => {
    if (user) {
      try {
        await deleteDoc(doc(db, "users", user, "notes", id));
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `users/${user}/notes/${id}`,
        );
      }
    } else {
      setNotes(notes.filter((n) => n.id !== id));
    }
  };

  const toggleShowOnMain = async (id: string) => {
    const item = notes.find((n) => n.id === id);
    if (!item) return;

    if (user) {
      try {
        await updateDoc(doc(db, "users", user, "notes", id), {
          showOnMain: !item.showOnMain,
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${user}/notes/${id}`,
        );
      }
    } else {
      setNotes(
        notes.map((n) =>
          n.id === id ? { ...n, showOnMain: !n.showOnMain } : n,
        ),
      );
    }
  };

  const toggleComplete = async (id: string) => {
    const item = notes.find((n) => n.id === id);
    if (!item) return;

    if (user) {
      try {
        await updateDoc(doc(db, "users", user, "notes", id), {
          completed: !item.completed,
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `users/${user}/notes/${id}`,
        );
      }
    } else {
      setNotes(
        notes.map((n) =>
          n.id === id ? { ...n, completed: !n.completed } : n,
        ),
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div
        className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
      >
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
          <StickyNote className="text-white/80" />
          Sticky Notes
        </h2>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            placeholder="Type a new note..."
            className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors`}
          />
          <div className="flex gap-2 items-center">
            {colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full ${color} ${selectedColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""}`}
              />
            ))}
          </div>
          <button
            onClick={() => setShowOnMain(!showOnMain)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${showOnMain ? "bg-white/10 border-white/30 text-white" : "bg-black/40 border-white/10 text-white/40"}`}
            title="Show on Main Dashboard"
          >
            <Home size={18} />
          </button>
          <button
            onClick={addNote}
            className={`${currentTheme.button} ${currentTheme.buttonHover} text-white font-medium px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2`}
          >
            <Plus size={20} /> Add
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${note.color} p-5 rounded-2xl text-slate-900 shadow-md relative group min-h-[120px] ${note.completed ? 'opacity-50' : ''}`}
            >
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleComplete(note.id)}
                  className={`${note.completed ? "text-slate-900" : "text-slate-900/40"} hover:text-slate-900/80`}
                  title={note.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  {note.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <button
                  onClick={() => toggleShowOnMain(note.id)}
                  className={`${note.showOnMain ? "text-slate-900" : "text-slate-900/40"} hover:text-slate-900/80`}
                  title={
                    note.showOnMain
                      ? "Hide from Main Dashboard"
                      : "Show on Main Dashboard"
                  }
                >
                  <Home size={18} />
                </button>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-slate-900/40 hover:text-slate-900/80"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <p className={`font-medium whitespace-pre-wrap pr-12 ${note.completed ? 'line-through' : ''}`}>
                {note.text}
              </p>
            </motion.div>
          ))}
          {notes.length === 0 && (
            <div className="col-span-full text-center p-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-2xl">
              No sticky notes yet. Add one above!
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const themeColors: Record<
  string,
  {
    bg: string;
    border: string;
    text: string;
    button: string;
    buttonHover: string;
    gradient: string;
  }
> = {
  slate: {
    bg: "bg-slate-900",
    border: "border-slate-700",
    text: "text-slate-100",
    button: "bg-indigo-600",
    buttonHover: "hover:bg-indigo-700",
    gradient: "from-indigo-600 to-violet-700",
  },
  indigo: {
    bg: "bg-indigo-950",
    border: "border-indigo-800",
    text: "text-indigo-100",
    button: "bg-indigo-500",
    buttonHover: "hover:bg-indigo-600",
    gradient: "from-indigo-500 to-blue-600",
  },
  emerald: {
    bg: "bg-emerald-950",
    border: "border-emerald-800",
    text: "text-emerald-100",
    button: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
    gradient: "from-emerald-600 to-teal-700",
  },
  rose: {
    bg: "bg-rose-950",
    border: "border-rose-800",
    text: "text-rose-100",
    button: "bg-rose-600",
    buttonHover: "hover:bg-rose-700",
    gradient: "from-rose-600 to-pink-700",
  },
  light: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-900",
    button: "bg-slate-900",
    buttonHover: "hover:bg-slate-800",
    gradient: "from-slate-100 to-slate-200",
  },
  whitish: {
    bg: "bg-slate-100",
    border: "border-slate-300",
    text: "text-slate-900",
    button: "bg-slate-800",
    buttonHover: "hover:bg-slate-900",
    gradient: "from-slate-200 to-slate-300",
  },
  darkish: {
    bg: "bg-zinc-900",
    border: "border-zinc-700",
    text: "text-zinc-100",
    button: "bg-zinc-700",
    buttonHover: "hover:bg-zinc-600",
    gradient: "from-zinc-800 to-zinc-900",
  },
  dark: {
    bg: "bg-black",
    border: "border-white/10",
    text: "text-white",
    button: "bg-white text-black",
    buttonHover: "hover:bg-gray-200",
    gradient: "from-gray-900 to-black",
  },
  ocean: {
    bg: "bg-cyan-950",
    border: "border-cyan-800",
    text: "text-cyan-100",
    button: "bg-cyan-600",
    buttonHover: "hover:bg-cyan-700",
    gradient: "from-cyan-700 to-blue-900",
  },
  sunset: {
    bg: "bg-orange-950",
    border: "border-orange-800",
    text: "text-orange-100",
    button: "bg-orange-600",
    buttonHover: "hover:bg-orange-700",
    gradient: "from-orange-600 to-red-800",
  },
  forest: {
    bg: "bg-green-950",
    border: "border-green-800",
    text: "text-green-100",
    button: "bg-green-600",
    buttonHover: "hover:bg-green-700",
    gradient: "from-green-700 to-emerald-900",
  },
  neon: {
    bg: "bg-fuchsia-950",
    border: "border-fuchsia-800",
    text: "text-fuchsia-100",
    button: "bg-fuchsia-600",
    buttonHover: "hover:bg-fuchsia-700",
    gradient: "from-fuchsia-600 to-purple-800",
  },
  midnight: {
    bg: "bg-blue-950",
    border: "border-blue-900",
    text: "text-blue-100",
    button: "bg-blue-700",
    buttonHover: "hover:bg-blue-800",
    gradient: "from-blue-900 to-indigo-950",
  },
  custom: {
    bg: "bg-[var(--custom-bg)]",
    border: "border-[var(--custom-button)]/30",
    text: "text-[var(--custom-text)]",
    button: "bg-[var(--custom-button)] text-[var(--custom-text)]",
    buttonHover: "hover:opacity-80",
    gradient: "from-[var(--custom-bg)] to-[var(--custom-bg)]",
  }
};

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");

  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("schedule");

  const [userName, setUserName] = useState("Student");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [userClasses, setUserClasses] =
    useState<Record<string, string>>(defaultClasses);
  const [footerText, setFooterText] = useState("Made by Mpro1 Studios © 2026");
  const [creditsText, setCreditsText] = useState("");
  const [agendaText, setAgendaText] = useState("");
  const [agendaVisibility, setAgendaVisibility] = useState("hidden");
  const [tabsVisibility, setTabsVisibility] = useState<Record<string, boolean>>({
    schedule: true,
    homework: true,
    calculator: true,
    notes: true,
    community: true,
    awards: true,
    agenda: true,
  });

  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [activePopup, setActivePopup] = useState<AdminPopup | null>(null);

  const [loginFirstName, setLoginFirstName] = useState("");
  const [loginLastName, setLoginLastName] = useState("");
  const [localTheme, setLocalTheme] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('tutorialSeen') !== 'true';
  });
  const [checkedSchedule, setCheckedSchedule] = useState<string[]>(() => {
    const stored = localStorage.getItem('checkedSchedule');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === new Date().toDateString()) {
          return parsed.items;
        }
      } catch (e) {}
    }
    return [];
  });

  const toggleScheduleCheck = (period: string) => {
    setCheckedSchedule(prev => {
      const newChecked = prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period];
      localStorage.setItem('checkedSchedule', JSON.stringify({ date: new Date().toDateString(), items: newChecked }));
      return newChecked;
    });
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, "settings", "global"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.footerText) setFooterText(data.footerText);
          if (data.creditsText) setCreditsText(data.creditsText);
          if (data.agendaText) setAgendaText(data.agendaText);
          if (data.agendaVisibility) setAgendaVisibility(data.agendaVisibility);
          if (data.tabsVisibility) setTabsVisibility(data.tabsVisibility);
        }
      },
      () => {},
    );
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser.uid);
        try {
          await updateDoc(doc(db, "users", currentUser.uid), {
            isOnline: true,
            lastActive: new Date().getTime()
          });
        } catch (e) {}
      } else {
        const localUserId = localStorage.getItem("localUserId");
        if (localUserId) {
          setUser(localUserId);
          try {
            await updateDoc(doc(db, "users", localUserId), {
              isOnline: true,
              lastActive: new Date().getTime()
            });
          } catch (e) {}
        } else {
          // Check if they have old localStorage data
          const oldUserName = localStorage.getItem("userName");
          if (oldUserName) {
            try {
              const newUid = "local_" + Date.now().toString() + Math.random().toString(36).substring(7);
              localStorage.setItem("localUserId", newUid);
              const oldClasses = JSON.parse(localStorage.getItem("userClasses") || "null");
              
              await setDoc(doc(db, "users", newUid), {
                displayName: oldUserName,
                joinedAt: new Date(),
                lastActive: new Date(),
                classes: oldClasses || defaultClasses
              });

              // Migrate homework
              const oldHomework = JSON.parse(localStorage.getItem("homework") || "null");
              if (oldHomework && Array.isArray(oldHomework)) {
                for (const hw of oldHomework) {
                  await setDoc(doc(db, "users", newUid, "homework", hw.id || Date.now().toString()), hw);
                }
              }

              // Migrate notes
              const oldNotes = JSON.parse(localStorage.getItem("notes") || "null");
              if (oldNotes && Array.isArray(oldNotes)) {
                for (const note of oldNotes) {
                  await setDoc(doc(db, "users", newUid, "notes", note.id || Date.now().toString()), note);
                }
              }
              
              // Clear old localStorage data so we don't migrate again
              localStorage.removeItem("userName");
              localStorage.removeItem("userClasses");
              localStorage.removeItem("homework");
              localStorage.removeItem("notes");
              
              setUser(newUid);
              setLoadingAuth(false);
              return;
            } catch (e) {
              console.error("Migration failed:", e);
            }
          }

          if (user) {
            try {
              await updateDoc(doc(db, "users", user), {
                isOnline: false,
                lastActive: new Date().getTime()
              });
            } catch (e) {}
          }
          setUser(null);
        }
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        await updateDoc(doc(db, "users", user), {
          isOnline: true,
          lastActive: new Date().getTime()
        });
      } catch (e) {}
    }, 60000); // Every minute
    
    const handleBeforeUnload = () => {
      // Best effort to set offline on close
      try {
        updateDoc(doc(db, "users", user), {
          isOnline: false,
          lastActive: new Date().getTime()
        });
      } catch (e) {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      const unsubProfile = onSnapshot(
        doc(db, "users", user),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            setUserName(data.displayName || "Student");
            setUserClasses(data.classes || defaultClasses);
          } else {
            setUserProfile(null);
          }
          setLoadingProfile(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user}`);
          setLoadingProfile(false);
        },
      );

      const unsubHomework = onSnapshot(
        collection(db, "users", user, "homework"),
        (snapshot) => {
          const hwData: HomeworkItem[] = [];
          snapshot.forEach((doc) => hwData.push(doc.data() as HomeworkItem));
          setHomework(hwData);
        },
        (error) => {
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${user}/homework`,
          );
        },
      );

      const unsubNotes = onSnapshot(
        collection(db, "users", user, "notes"),
        (snapshot) => {
          const notesData: Note[] = [];
          snapshot.forEach((doc) => notesData.push(doc.data() as Note));
          setNotes(notesData);
        },
        (error) => {
          handleFirestoreError(
            error,
            OperationType.LIST,
            `users/${user}/notes`,
          );
        },
      );

      return () => {
        unsubProfile();
        unsubHomework();
        unsubNotes();
      };
    } else {
      setUserProfile(null);
      setLoadingProfile(false);
      setUserClasses(defaultClasses);
    }
  }, [user]);

  // Fetch roles
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "roles"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Role,
      );
      setAllRoles(rolesData);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail.tab) setActiveTab(e.detail.tab);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  // Listen for popups
  useEffect(() => {
    if (!user || !userProfile) return;
    
    // Listen for recent popups
    const q = query(collection(db, "popups"), orderBy("createdAt", "desc"), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const popupData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as AdminPopup;
        
        // Check if user has already seen this popup (store in localStorage)
        const seenPopups = JSON.parse(localStorage.getItem('seenPopups') || '[]');
        if (seenPopups.includes(popupData.id)) return;

        // Check if popup targets this user
        let shouldShow = false;
        if (popupData.target === 'all') {
          shouldShow = true;
        } else if (popupData.target === 'role' && popupData.targetId === userProfile.roleId) {
          shouldShow = true;
        } else if (popupData.target === 'user' && popupData.targetId === user.uid) {
          shouldShow = true;
        }

        if (shouldShow) {
          setActivePopup(popupData);
          // Play sound if available
          if (popupData.soundUrl) {
            const audio = new Audio(popupData.soundUrl);
            audio.play().catch(e => console.error("Error playing popup sound:", e));
          }
          // Log view
          addDoc(collection(db, 'popup_analytics'), {
            popupId: popupData.id,
            userId: user.uid,
            userName: userProfile?.name || user.displayName || 'Unknown',
            action: 'view',
            timestamp: new Date()
          }).catch(console.error);
        }
      }
    });
    return () => unsubscribe();
  }, [user, userProfile]);

  // Determine user permissions
  useEffect(() => {
    if (userProfile?.roleId) {
      const role = allRoles.find((r) => r.id === userProfile.roleId);
      setUserRole(role || null);
    } else {
      setUserRole(null);
    }
  }, [userProfile?.roleId, allRoles]);

  const userPermissions = userRole?.permissions || [];
  const isSuperAdmin = userProfile?.displayName
    ?.toLowerCase()
    .includes("markustheadmin");

  const canViewAdminPanel =
    isSuperAdmin || userPermissions.includes("admin_panel");
  const canEditCredits =
    isSuperAdmin || userPermissions.includes("edit_credits");
  const canManageRoles =
    isSuperAdmin || userPermissions.includes("manage_roles");
  const canManageUsers =
    isSuperAdmin || userPermissions.includes("manage_users");
  const canCreatePosts =
    isSuperAdmin || userPermissions.includes("create_posts");

  useEffect(() => {
    if (!user) return;

    // Set online status to true on mount
    const setOnline = async () => {
      try {
        await updateDoc(doc(db, "users", user), { isOnline: true });
      } catch (e) {
        // Ignore if document doesn't exist yet
      }
    };
    setOnline();

    // Increment time spent every minute
    const timeTimer = setInterval(async () => {
      try {
        await updateDoc(doc(db, "users", user), { timeSpent: increment(1) });
      } catch (e) {
        // Ignore
      }
    }, 60000);

    // Set online status to false on visibility change or unmount
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        updateDoc(doc(db, "users", user), { isOnline: false }).catch(() => {});
      } else {
        updateDoc(doc(db, "users", user), { isOnline: true }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleBeforeUnload = () => {
      updateDoc(doc(db, "users", user), { isOnline: false }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(timeTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      updateDoc(doc(db, "users", user), { isOnline: false }).catch(() => {});
    };
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("localUserId");
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSaveName = async (newName: string) => {
    setUserName(newName);
    setIsEditingName(false);
    if (user && userProfile) {
      try {
        await updateDoc(doc(db, "users", user), { displayName: newName });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user}`);
      }
    }
  };

  if (loadingAuth || (user && loadingProfile)) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (showWelcomeAnimation) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.5, duration: 1 }}
          className="text-4xl md:text-6xl font-extrabold text-white tracking-tight"
        >
          Welcome,
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: -100 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.6, duration: 1.2, delay: 0.3 }}
          onAnimationComplete={() => {
            setTimeout(() => setShowWelcomeAnimation(false), 2000);
          }}
          className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mt-4 drop-shadow-lg"
        >
          {welcomeName}
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-700"
        >
          <div className="w-20 h-20 bg-indigo-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg">
            <Clock size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MySchoolDay</h1>
          <p className="text-slate-400 mb-6">Sign in to manage your schedule, homework, and notes.</p>
          
          <div className="space-y-4 mb-6">
            <input
              type="text"
              value={loginFirstName}
              onChange={(e) => setLoginFirstName(e.target.value)}
              placeholder="First Name"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-center"
            />
            <input
              type="text"
              value={loginLastName}
              onChange={(e) => setLoginLastName(e.target.value)}
              placeholder="Last Name"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-center"
            />
            <p className="text-xs text-slate-500 mt-2">
              Note: Regular login saves data to this browser only. Use Google Login to save your data across devices.
            </p>
          </div>

          <button
            onClick={async () => {
              if (!loginFirstName.trim() || !loginLastName.trim()) {
                alert("Please enter your first and last name.");
                return;
              }
              try {
                const newUid = "local_" + Date.now().toString() + Math.random().toString(36).substring(7);
                localStorage.setItem("localUserId", newUid);
                
                const userDocRef = doc(db, "users", newUid);
                const finalName = `${loginFirstName.trim()} ${loginLastName.trim()}`.trim();

                await setDoc(userDocRef, {
                  displayName: finalName,
                  joinedAt: new Date(),
                  lastActive: new Date(),
                  classes: defaultClasses
                });
                
                setUser(newUid);
                setWelcomeName(finalName);
                setShowWelcomeAnimation(true);
              } catch (error: any) {
                console.error("Login failed:", error);
                alert("Login failed: " + error.message);
              }
            }}
            className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-colors mb-4"
          >
            Next
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-px bg-slate-700"></div>
            <span className="text-slate-500 text-sm font-medium">OR</span>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          <button
            onClick={async () => {
              try {
                const result = await signInWithPopup(auth, googleProvider);
                const currentUser = result.user;
                
                // Ensure user document exists
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                
                const finalName = currentUser.displayName || "Student";

                if (!userDoc.exists()) {
                  await setDoc(userDocRef, {
                    displayName: finalName,
                    email: currentUser.email,
                    photoURL: currentUser.photoURL,
                    joinedAt: new Date(),
                    lastActive: new Date(),
                    classes: defaultClasses
                  });
                } else {
                  await updateDoc(userDocRef, {
                    lastActive: new Date()
                  });
                }
                setWelcomeName(finalName);
                setShowWelcomeAnimation(true);
              } catch (error: any) {
                console.error("Login failed:", error);
                alert("Login failed: " + error.message + "\n\nMake sure Google Auth is enabled and this domain is authorized in the Firebase Console.");
              }
            }}
            className="w-full bg-white text-slate-900 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (user && !userProfile) {
    return <OnboardingScreen user={user} />;
  }

  const dayType = getDayType(currentTime);
  const abDay = getABDay(currentTime);
  const schedule = schedules[dayType] || [];

  let currentPeriod: ScheduleBlock | null = null;
  let nextPeriod: ScheduleBlock | null = null;
  let timeRemaining: number | null = null;
  let progress = 0;
  let schoolTimeRemaining: number | null = null;

  if (dayType !== "Weekend") {
    // Calculate total school time remaining
    if (schedule.length > 0) {
      const lastBlock = schedule[schedule.length - 1];
      const schoolEnd = parseTime(lastBlock.end);
      if (currentTime < schoolEnd) {
        schoolTimeRemaining = Math.floor(
          (schoolEnd.getTime() - currentTime.getTime()) / 1000,
        );
      }
    }

    for (let i = 0; i < schedule.length; i++) {
      const block = schedule[i];
      const start = parseTime(block.start);
      const end = parseTime(block.end);

      if (currentTime >= start && currentTime <= end) {
        currentPeriod = block;
        nextPeriod = schedule[i + 1] || null;
        timeRemaining = Math.floor(
          (end.getTime() - currentTime.getTime()) / 1000,
        );
        break;
      } else if (currentTime < start) {
        if (!currentPeriod) {
          nextPeriod = block;
          timeRemaining = Math.floor(
            (start.getTime() - currentTime.getTime()) / 1000,
          );
          const prevBlock = i > 0 ? schedule[i - 1] : null;
          if (!prevBlock) {
            currentPeriod = {
              period: "Before School",
              isPassing: true,
              name: "Before School",
              start: "00:00",
              end: block.start,
            };
          } else {
            currentPeriod = {
              period: "Passing",
              isPassing: true,
              name: "Passing Period",
              start: prevBlock.end,
              end: block.start,
            };
          }
        }
        break;
      }
    }

    if (!currentPeriod && schedule.length > 0) {
      const lastEnd = parseTime(schedule[schedule.length - 1].end);
      if (currentTime > lastEnd) {
        currentPeriod = {
          period: "Done",
          name: "School is over!",
          start: schedule[schedule.length - 1].end,
          end: "23:59",
        };
      }
    }

    if (
      currentPeriod &&
      currentPeriod.start &&
      currentPeriod.end &&
      currentPeriod.period !== "Done"
    ) {
      const start = parseTime(currentPeriod.start).getTime();
      const end = parseTime(currentPeriod.end).getTime();
      const total = end - start;
      const elapsed = currentTime.getTime() - start;
      progress = Math.max(0, Math.min(100, (elapsed / total) * 100));
    }
  }

  const visibleHomework = homework.filter((h) => h.showOnMain);
  const visibleNotes = notes.filter((n) => n.showOnMain);

  const rawTheme = localTheme || userProfile?.theme || "slate";
  const proDayThemes = ["ocean", "sunset", "forest", "neon", "midnight", "custom"];
  const theme = (!userProfile?.proDayActive && proDayThemes.includes(rawTheme)) ? "slate" : rawTheme;
  const currentTheme = themeColors[theme] || themeColors.slate;
  const liquidGlass = userProfile?.proDayActive && userProfile?.liquidGlass;
  const customColors = userProfile?.customColors || { bg: "#0f172a", text: "#f8fafc", button: "#6366f1" };

  const handleClosePopup = () => {
    if (activePopup) {
      const seenPopups = JSON.parse(localStorage.getItem('seenPopups') || '[]');
      localStorage.setItem('seenPopups', JSON.stringify([...seenPopups, activePopup.id]));
      
      // Log click
      if (user) {
        addDoc(collection(db, 'popup_analytics'), {
          popupId: activePopup.id,
          userId: user.uid,
          userName: userProfile?.name || user.displayName || 'Unknown',
          action: 'click',
          timestamp: new Date()
        }).catch(console.error);
      }

      setActivePopup(null);
    }
  };

  return (
    <div
      className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} ${['light', 'whitish'].includes(theme) ? 'invert-text' : ''} p-4 md:p-8 font-sans transition-colors duration-500 ${liquidGlass ? 'liquid-glass-enabled' : ''}`}
      style={
        theme === "custom"
          ? ({
              "--custom-bg": customColors.bg,
              "--custom-text": customColors.text,
              "--custom-button": customColors.button,
            } as React.CSSProperties)
          : undefined
      }
    >
      {activePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          {activePopup.type === 'update' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`relative max-w-2xl w-full bg-black/90 border-2 ${currentTheme.border} rounded-3xl overflow-hidden shadow-2xl p-8`}
            >
              <button 
                onClick={handleClosePopup}
                className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
              <h2 className="text-4xl font-extrabold text-white mb-6 tracking-tight">{activePopup.heading}</h2>
              <div className="text-white/80 whitespace-pre-wrap text-lg leading-relaxed space-y-2">
                {activePopup.text?.split('\n').map((line, i) => (
                  <p key={i} className="flex items-start gap-2">
                    {line.trim().startsWith('-') ? (
                      <>
                        <span className="text-amber-400 mt-1.5">•</span>
                        <span>{line.trim().substring(1).trim()}</span>
                      </>
                    ) : (
                      line
                    )}
                  </p>
                ))}
              </div>
            </motion.div>
          ) : activePopup.type === 'proday' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`relative max-w-lg w-full bg-gradient-to-br from-amber-500/20 to-yellow-600/20 border-2 border-amber-400/50 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.2)]`}
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-amber-500/30">
                  <Shield size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 mb-4">{activePopup.heading}</h2>
                <p className="text-amber-100/90 whitespace-pre-wrap mb-8 text-lg">{activePopup.message || activePopup.text}</p>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => {
                      setActiveTab("settings");
                      handleClosePopup();
                    }}
                    className="w-full py-4 rounded-xl font-bold transition-all bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white shadow-lg shadow-amber-500/25"
                  >
                    Open
                  </button>
                  <button 
                    onClick={handleClosePopup}
                    className="text-amber-200/60 hover:text-amber-200 text-sm font-medium underline underline-offset-4 transition-colors"
                  >
                    I'll view it later
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`relative max-w-lg w-full bg-black/80 border ${currentTheme.border} rounded-3xl overflow-hidden shadow-2xl`}
            >
              {activePopup.videoUrl ? (
                <div className="w-full aspect-video bg-black/40">
                  <iframe 
                    src={activePopup.videoUrl.includes('youtube.com/watch?v=') ? activePopup.videoUrl.replace('watch?v=', 'embed/') : activePopup.videoUrl.includes('youtu.be/') ? activePopup.videoUrl.replace('youtu.be/', 'youtube.com/embed/') : activePopup.videoUrl} 
                    className="w-full h-full" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen
                  />
                </div>
              ) : activePopup.imageUrl ? (
                <div className="w-full h-48 bg-black/40">
                  <img src={activePopup.imageUrl} alt="Popup" className="w-full h-full object-cover" />
                </div>
              ) : null}
              <div className="p-8">
                <h2 className="text-2xl font-bold text-white mb-4">{activePopup.heading}</h2>
                <p className="text-white/80 whitespace-pre-wrap mb-8">{activePopup.message || activePopup.text}</p>
                <button 
                  onClick={handleClosePopup}
                  className={`w-full py-3 rounded-xl font-medium transition-all ${currentTheme.button} ${currentTheme.buttonHover} text-white`}
                >
                  {activePopup.buttonText || "Dismiss"}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header
          className={`flex flex-col md:flex-row items-start md:items-center justify-between bg-black/20 p-6 rounded-3xl shadow-lg border ${currentTheme.border} gap-6 backdrop-blur-sm`}
        >
          <div>
            <div className="flex items-center gap-4">
              {userProfile?.photoURL ? (
                <div className={`relative ${
                  userProfile?.profilePicStyle === 'crown' ? 'p-1 bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.6)]' :
                  userProfile?.profilePicStyle === 'sunglasses' ? 'ring-4 ring-indigo-500/50 rounded-full' :
                  userProfile?.profilePicStyle === 'initials' ? 'ring-2 ring-white/20 rounded-full' :
                  'rounded-full'
                }`}>
                  {userProfile?.profilePicStyle === 'crown' && (
                    <div className="absolute -top-4 -right-2 text-2xl drop-shadow-md z-10">👑</div>
                  )}
                  {userProfile?.profilePicStyle === 'sunglasses' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl drop-shadow-md z-10">😎</div>
                  )}
                  <img 
                    src={userProfile.photoURL} 
                    alt="Profile" 
                    referrerPolicy="no-referrer"
                    className={`w-16 h-16 rounded-full object-cover ${userProfile?.profilePicStyle === 'sunglasses' ? 'opacity-50' : ''}`}
                  />
                </div>
              ) : (
                <div className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                  userProfile?.profilePicStyle === 'crown' ? 'bg-gradient-to-tr from-yellow-400 to-amber-600 text-white shadow-[0_0_15px_rgba(251,191,36,0.6)]' :
                  userProfile?.profilePicStyle === 'sunglasses' ? 'bg-indigo-500/20 text-indigo-300 ring-4 ring-indigo-500/50' :
                  'bg-white/10 text-white ring-2 ring-white/20'
                }`}>
                  {userProfile?.profilePicStyle === 'crown' && (
                    <div className="absolute -top-4 -right-2 text-2xl drop-shadow-md z-10">👑</div>
                  )}
                  {userProfile?.profilePicStyle === 'sunglasses' ? '😎' : userName.charAt(0).toUpperCase()}
                </div>
              )}
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className={`bg-black/40 border ${currentTheme.border} rounded-xl px-3 py-1 text-2xl font-bold text-white focus:outline-none w-48`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveName(tempName);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleSaveName(tempName)}
                    className={`p-2 ${currentTheme.button} ${currentTheme.buttonHover} text-white rounded-lg transition-colors`}
                  >
                    <CheckCircle2 size={20} />
                  </button>
                </div>
              ) : (
                <h1
                  className={`text-3xl font-bold flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity ${
                    userProfile?.namePlate === 'golden' ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]' :
                    userProfile?.namePlate === 'silver' ? 'text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-400 to-slate-300 drop-shadow-[0_0_8px_rgba(148,163,184,0.5)]' :
                    userProfile?.namePlate === 'liquid' ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-400 to-pink-300 drop-shadow-[0_0_12px_rgba(167,139,250,0.6)]' :
                    'text-white'
                  }`}
                  onClick={() => {
                    setTempName(userName);
                    setIsEditingName(true);
                  }}
                >
                  <BookOpen className={`opacity-80 ${
                    userProfile?.namePlate === 'golden' ? 'text-amber-400' :
                    userProfile?.namePlate === 'silver' ? 'text-slate-300' :
                    userProfile?.namePlate === 'liquid' ? 'text-purple-400' :
                    'text-white'
                  }`} size={32} />
                  {userName}'s Day
                </h1>
              )}
            </div>
            <p className="opacity-70 mt-2 text-lg">
              {currentTime.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            {dayType !== "Weekend" && (
              <div className="flex gap-2 mt-3">
                <span
                  className={`px-3 py-1 bg-white/10 rounded-full text-sm font-medium border ${currentTheme.border}`}
                >
                  {dayType} Day
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium border border-emerald-500/30">
                  {abDay} Day
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-4">
            {user && (
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-white flex items-center gap-2 text-sm transition-colors"
              >
                <LogOut size={16} /> Sign Out
              </button>
            )}
            <div
              className={`text-left md:text-right w-full md:w-auto bg-black/40 p-5 rounded-2xl border ${currentTheme.border}`}
            >
              <div
                className={`text-5xl md:text-6xl font-mono font-bold ${currentTheme.text} tracking-tight`}
              >
                {currentTime.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              {schoolTimeRemaining !== null && schoolTimeRemaining > 0 ? (
                <div className="text-xl md:text-2xl font-mono font-medium text-amber-400 mt-3">
                  {formatTimeRemaining(schoolTimeRemaining)} left in day
                </div>
              ) : dayType !== "Weekend" ? (
                <div className="text-xl md:text-2xl font-mono font-medium text-emerald-400 mt-3">
                  School is over!
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div
          className={`flex flex-col sm:flex-row gap-2 bg-black/20 p-2 rounded-2xl border ${currentTheme.border} backdrop-blur-sm overflow-x-auto custom-scrollbar`}
        >
          {tabsVisibility.schedule !== false && (
            <button
              onClick={() => setActiveTab("schedule")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "schedule" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <LayoutDashboard size={20} /> Schedule
            </button>
          )}
          {tabsVisibility.homework !== false && (
            <button
              onClick={() => setActiveTab("homework")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "homework" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <BookMarked size={20} /> Homework
            </button>
          )}
          {tabsVisibility.calculator !== false && (
            <button
              onClick={() => setActiveTab("calculator")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "calculator" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Calculator size={20} /> Grade Calculator
            </button>
          )}
          {tabsVisibility.notes !== false && (
            <button
              onClick={() => setActiveTab("notes")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "notes" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <StickyNote size={20} /> Sticky Notes
            </button>
          )}
          {tabsVisibility.community !== false && (
            <button
              onClick={() => setActiveTab("community")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "community" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Users size={20} /> Community
            </button>
          )}
          {tabsVisibility.awards !== false && (
            <button
              onClick={() => setActiveTab("awards")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "awards" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Trophy size={20} /> Awards
            </button>
          )}
          {tabsVisibility.agenda !== false && (
            <button
              onClick={() => setActiveTab("agenda")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "agenda" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <BookOpen size={20} /> Agenda
            </button>
          )}
          <button
            id="settings-tab-btn"
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "settings" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
          >
            <Settings size={20} /> Settings
            {showTutorial && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 z-50 pointer-events-none">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl border border-indigo-400 relative pointer-events-auto"
                >
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-600 rotate-45 border-b border-r border-indigo-400"></div>
                  <h4 className="font-bold mb-1">Settings Tab</h4>
                  <p className="text-sm text-indigo-100 mb-3">Customize your theme, edit your classes, and report bugs here!</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTutorial(false);
                      localStorage.setItem('tutorialSeen', 'true');
                    }}
                    className="w-full py-1.5 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors"
                  >
                    Skip Tutorial
                  </button>
                </motion.div>
              </div>
            )}
          </button>
          {canViewAdminPanel && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === "admin" ? `${currentTheme.button} text-white shadow-md` : "text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              <Shield size={20} /> Admin
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            {agendaVisibility !== "hidden" && agendaText && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-black/20 backdrop-blur-sm p-6 rounded-3xl border ${currentTheme.border}`}
              >
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <BookOpen size={20} className="text-amber-400" /> Agenda
                </h2>
                <div className="text-white/80 whitespace-pre-wrap">
                  {agendaVisibility === "snippet" ? agendaText.split('\n')[0] : agendaText}
                </div>
              </motion.div>
            )}
            {/* Current Status */}
            {dayType !== "Weekend" ? (
              <div className="grid md:grid-cols-2 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-gradient-to-br ${currentTheme.gradient} p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <Clock size={120} />
                  </div>
                  <div>
                    <h2 className="text-white/80 font-medium mb-2 text-lg">
                      Current Class
                    </h2>
                    <div className="text-4xl font-bold text-white mb-2 leading-tight">
                      {getClassName(currentPeriod?.period, abDay, userClasses)}
                    </div>
                    {currentPeriod?.period !== "Done" &&
                      currentPeriod?.period !== "Passing" &&
                      currentPeriod?.period !== "Before School" &&
                      currentPeriod?.period !== "Lunch" && (
                        <div className="text-white/80 font-medium">
                          Period {currentPeriod?.period}
                        </div>
                      )}
                  </div>

                  {timeRemaining !== null && (
                    <div className="mt-8">
                      <div className="flex justify-between items-end mb-2">
                        <div className="text-sm text-white/80 font-medium">
                          {currentPeriod?.isPassing
                            ? "Time until next class"
                            : "Time left in class"}
                        </div>
                        <div className="text-4xl font-mono font-bold tracking-tight text-white">
                          {formatTimeRemaining(timeRemaining)}
                        </div>
                      </div>
                      {currentPeriod?.period !== "Done" && (
                        <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-white/80 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1 }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`bg-black/20 p-8 rounded-3xl shadow-lg border ${currentTheme.border} flex flex-col justify-between backdrop-blur-sm`}
                >
                  <div>
                    <h2 className="text-white/60 font-medium mb-2 text-lg">
                      Next Up
                    </h2>
                    {nextPeriod ? (
                      <>
                        <div className="text-2xl font-bold text-white mb-1">
                          {getClassName(nextPeriod.period, abDay, userClasses)}
                        </div>
                        <div className="text-white/60">
                          {nextPeriod.period !== "Lunch" &&
                          nextPeriod.period !== "ADV" &&
                          nextPeriod.period !== "HR"
                            ? `Period ${nextPeriod.period} • `
                            : ""}
                          {format12Hour(nextPeriod.start)} -{" "}
                          {format12Hour(nextPeriod.end)}
                        </div>
                      </>
                    ) : (
                      <div className="text-xl text-white/60">
                        No more classes today!
                      </div>
                    )}
                  </div>

                  {nextPeriod && (
                    <div className="mt-6 p-4 bg-black/40 rounded-xl flex items-center gap-3">
                      <ChevronRight className="text-white/60" />
                      <span className="text-white/80">
                        Starts at {format12Hour(nextPeriod.start)}
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>
            ) : (
              <div
                className={`bg-black/20 p-12 rounded-3xl text-center border ${currentTheme.border} backdrop-blur-sm`}
              >
                <h2 className="text-3xl font-bold text-white mb-4">
                  It's the Weekend!
                </h2>
                <p className="text-white/60">
                  Enjoy your time off. See you on Monday.
                </p>
              </div>
            )}

            {/* Homework on Main Page */}
            {visibleHomework.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={`bg-black/20 rounded-3xl shadow-lg border ${currentTheme.border} p-6 backdrop-blur-sm`}
              >
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <BookMarked className="text-amber-400" />
                  Active Homework
                </h2>
                <div className="grid gap-3">
                  {visibleHomework.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-black/40 p-4 rounded-xl border ${currentTheme.border} flex justify-between items-center transition-all ${item.completed ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            if (user) {
                              try {
                                await updateDoc(doc(db, "users", user, "homework", item.id), {
                                  completed: !item.completed,
                                });
                              } catch (error) {
                                handleFirestoreError(
                                  error,
                                  OperationType.UPDATE,
                                  `users/${user}/homework/${item.id}`,
                                );
                              }
                            } else {
                              setHomework(
                                homework.map((h) =>
                                  h.id === item.id ? { ...h, completed: !h.completed } : h,
                                ),
                              );
                            }
                          }}
                          className="text-white/60 hover:text-white transition-colors"
                        >
                          {item.completed ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} />}
                        </button>
                        <div className={`text-white/90 font-medium ${item.completed ? "line-through" : ""}`}>
                          {item.text}
                        </div>
                      </div>
                      {item.dueDate && (
                        <div className={`text-sm px-3 py-1 rounded-full ${item.completed ? "text-white/40 bg-white/5" : "text-amber-400/80 bg-amber-400/10"}`}>
                          Due: {new Date(item.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Notes on Main Page */}
            {visibleNotes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`bg-black/20 rounded-3xl shadow-lg border ${currentTheme.border} p-6 backdrop-blur-sm`}
              >
                <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                  <StickyNote className="text-white/80" />
                  Pinned Notes
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleNotes.map((note) => (
                    <div
                      key={note.id}
                      className={`${note.color} p-5 rounded-2xl text-slate-900 shadow-md relative min-h-[120px] ${note.completed ? 'opacity-50' : ''}`}
                    >
                      <p className={`font-medium whitespace-pre-wrap ${note.completed ? 'line-through' : ''}`}>
                        {note.text}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Full Schedule */}
            {dayType !== "Weekend" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`bg-black/20 rounded-3xl shadow-lg border ${currentTheme.border} overflow-hidden backdrop-blur-sm`}
              >
                <div className="p-6 border-b border-white/10 bg-black/20">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <CalendarDays className="text-white/60" />
                    Today's Schedule
                  </h2>
                </div>
                <div className="divide-y divide-white/10">
                  {schedule.map((block, idx) => {
                    const isCurrent = currentPeriod?.period === block.period;
                    const isChecked = checkedSchedule.includes(block.period);
                    return (
                      <div
                        key={idx}
                        className={`p-4 flex items-center justify-between transition-colors ${
                          isCurrent
                            ? "bg-white/10 border-l-4 border-white"
                            : "hover:bg-black/40 pl-5"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 text-center font-bold ${isCurrent ? "text-white" : "text-white/60"}`}
                          >
                            {block.period}
                          </div>
                          <div>
                            <div
                              className={`font-medium ${isCurrent ? "text-white" : "text-white/80"}`}
                            >
                              {getClassName(block.period, abDay, userClasses)}
                            </div>
                            <div className="text-sm text-white/60 font-mono">
                              {format12Hour(block.start)} -{" "}
                              {format12Hour(block.end)}
                            </div>
                          </div>
                        </div>
                        {isCurrent && (
                          <div
                            className={`px-3 py-1 ${currentTheme.button} text-white text-xs font-bold rounded-full uppercase tracking-wider`}
                          >
                            Now
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {activeTab === "homework" && (
          <HomeworkTab
            homework={homework}
            setHomework={setHomework}
            user={user}
            currentTheme={currentTheme}
          />
        )}
        {activeTab === "notes" && (
          <StickyNotesTab
            user={user}
            notes={notes}
            setNotes={setNotes}
            currentTheme={currentTheme}
          />
        )}
        {activeTab === "calculator" && (
          <GradeCalculator currentTheme={currentTheme} />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            user={user}
            userProfile={userProfile}
            userClasses={userClasses}
            setUserClasses={setUserClasses}
            currentTheme={currentTheme}
            footerText={footerText}
            creditsText={creditsText}
            setActiveTab={setActiveTab}
            setLocalTheme={setLocalTheme}
            isSuperAdmin={isSuperAdmin}
          />
        )}
        {activeTab === "community" && (
          <CommunityTab
            currentTheme={currentTheme}
            userProfile={userProfile}
            user={user}
            allRoles={allRoles}
          />
        )}
        {activeTab === "awards" && (
          <AwardsTab currentTheme={currentTheme} user={user} />
        )}
        {activeTab === "agenda" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-black/20 backdrop-blur-sm p-6 rounded-3xl border ${currentTheme.border}`}
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <BookOpen size={24} className="text-amber-400" /> Agenda
            </h2>
            <div className="text-white/80 whitespace-pre-wrap text-lg">
              {agendaText || "No agenda set for today."}
            </div>
          </motion.div>
        )}
        {activeTab === "admin" && canViewAdminPanel && (
          <AdminPanel
            currentTheme={currentTheme}
            globalSettings={{ footerText, creditsText, agendaText, agendaVisibility, tabsVisibility }}
            canEditCredits={canEditCredits}
            canManageRoles={canManageRoles}
            canManageUsers={canManageUsers}
            canCreatePosts={canCreatePosts}
            isSuperAdmin={isSuperAdmin}
            allRoles={allRoles}
            user={user}
            userProfile={userProfile}
          />
        )}
      </div>
    </div>
  );
}

function AdminPanel({
  currentTheme,
  globalSettings,
  canEditCredits,
  canManageRoles,
  canManageUsers,
  canCreatePosts,
  isSuperAdmin,
  allRoles,
  user,
  userProfile,
}: {
  currentTheme: any;
  globalSettings: any;
  canEditCredits: boolean;
  canManageRoles: boolean;
  canManageUsers: boolean;
  canCreatePosts: boolean;
  isSuperAdmin: boolean;
  allRoles: Role[];
  user: any;
  userProfile: any;
}) {
  const [activeAdminTab, setActiveAdminTab] = useState("settings");

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail.adminTab) setActiveAdminTab(e.detail.adminTab);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {canEditCredits && (
          <button
            onClick={() => setActiveAdminTab("settings")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "settings" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Global Settings
          </button>
        )}
        {canCreatePosts && (
          <button
            onClick={() => setActiveAdminTab("posts")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "posts" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Create Post
          </button>
        )}
        {canCreatePosts && (
          <button
            onClick={() => setActiveAdminTab("popups")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "popups" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Send Popups
          </button>
        )}
        {canManageRoles && (
          <button
            onClick={() => setActiveAdminTab("roles")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "roles" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Manage Roles
          </button>
        )}
        {canManageUsers && (
          <button
            onClick={() => setActiveAdminTab("users")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "users" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Manage Users
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveAdminTab("agenda")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "agenda" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Agenda
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveAdminTab("proday")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "proday" ? "bg-amber-500 text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            ProDay
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveAdminTab("analytics")}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${activeAdminTab === "analytics" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70 hover:bg-black/60"}`}
          >
            Analytics
          </button>
        )}
      </div>

      {activeAdminTab === "settings" && canEditCredits && (
        <AdminSettingsTab
          currentTheme={currentTheme}
          footerText={globalSettings?.footerText || ""}
          creditsText={globalSettings?.creditsText || ""}
        />
      )}
      {activeAdminTab === "posts" && canCreatePosts && (
        <AdminCreatePostTab
          currentTheme={currentTheme}
          user={user}
          userProfile={userProfile}
          allRoles={allRoles}
        />
      )}
      {activeAdminTab === "popups" && canCreatePosts && (
        <AdminPopupsTab currentTheme={currentTheme} allRoles={allRoles} />
      )}
      {activeAdminTab === "roles" && canManageRoles && (
        <AdminRolesTab currentTheme={currentTheme} allRoles={allRoles} />
      )}
      {activeAdminTab === "users" && canManageUsers && (
        <AdminUsersTab currentTheme={currentTheme} allRoles={allRoles} />
      )}
      {activeAdminTab === "agenda" && isSuperAdmin && (
        <AdminAgendaTab
          currentTheme={currentTheme}
          agendaText={globalSettings?.agendaText || ""}
          agendaVisibility={globalSettings?.agendaVisibility || "hidden"}
          tabsVisibility={globalSettings?.tabsVisibility || {}}
        />
      )}
      {activeAdminTab === "proday" && isSuperAdmin && (
        <AdminProDayTab currentTheme={currentTheme} allRoles={allRoles} />
      )}
      {activeAdminTab === "analytics" && isSuperAdmin && (
        <AdminAnalyticsTab currentTheme={currentTheme} />
      )}
    </div>
  );
}

function AwardsTab({ currentTheme, user }: { currentTheme: any, user: string | null }) {
  const [peopleAdded, setPeopleAdded] = useState("");
  const [peopleNames, setPeopleNames] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "award_submissions"), {
        userId: user,
        peopleAdded: parseInt(peopleAdded) || 0,
        peopleNames: peopleNames,
        rating: rating,
        timestamp: new Date().getTime(),
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setPeopleAdded("");
        setPeopleNames("");
        setRating(5);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "award_submissions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div
        className={`p-6 rounded-2xl border ${currentTheme.border} ${currentTheme.bg} bg-opacity-50`}
      >
        <h2 className="text-2xl font-bold mb-2 text-white flex items-center gap-2">
          <Shield className="text-amber-400" /> Awards Program
        </h2>
        <p className="text-white/70">
          Help grow MySchoolDay and earn premium perks!
        </p>
      </div>

      <form onSubmit={handleSubmit} className={`bg-black/40 p-6 md:p-8 rounded-2xl border ${currentTheme.border} space-y-6`}>
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Thank you!</h3>
            <p className="text-white/70">Your submission has been received.</p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-white/80 font-medium mb-2">How many people did you add?</label>
              <input
                type="number"
                min="0"
                value={peopleAdded}
                onChange={(e) => setPeopleAdded(e.target.value)}
                className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50`}
                required
              />
            </div>
            
            <div>
              <label className="block text-white/80 font-medium mb-2">What are their names?</label>
              <textarea
                value={peopleNames}
                onChange={(e) => setPeopleNames(e.target.value)}
                placeholder="List the names of people you invited..."
                rows={3}
                className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 resize-none`}
                required
              />
            </div>

            <div>
              <label className="block text-white/80 font-medium mb-2">Rate the app</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`text-2xl transition-colors ${star <= rating ? "text-amber-400" : "text-white/20 hover:text-white/40"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50 text-white font-medium py-3 px-6 rounded-xl transition-colors`}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </>
        )}
      </form>

      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-600/10 border border-amber-500/20 p-6 rounded-2xl text-center">
        <h3 className="text-amber-400 font-bold text-lg mb-2">Incentive Program</h3>
        <p className="text-amber-100/80 leading-relaxed">
          For adding more than ten people, you may get paid. Otherwise, you get premium perks. If you add more than ten people, you also get premium perks and maybe even the Admin Panel.
        </p>
      </div>
    </motion.div>
  );
}

function CommunityTab({
  currentTheme,
  userProfile,
  user,
  allRoles,
}: {
  currentTheme: any;
  userProfile: any;
  user: any;
  allRoles: Role[];
}) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userRole = allRoles.find((r) => r.id === userProfile?.roleId);
  const userPermissions = userRole?.permissions || [];
  const isSuperAdmin = userProfile?.displayName?.toLowerCase().includes("markustheadmin");
  const isCommunityRole = userRole?.name?.toLowerCase() === "community";
  const canCreatePosts = isSuperAdmin || userPermissions.includes("create_posts") || isCommunityRole;

  const [newPostHeading, setNewPostHeading] = useState("");
  const [newPostText, setNewPostText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostHeading || !newPostText) return;
    setIsSubmitting(true);
    try {
      const authorRoleName = userRole
        ? userRole.name
        : isSuperAdmin
          ? "Super Admin"
          : "Admin";

      await addDoc(collection(db, "community_posts"), {
        heading: newPostHeading,
        text: newPostText,
        authorId: user.uid || user,
        authorName: userProfile?.displayName || user.displayName || "Admin",
        authorRoleName,
        createdAt: new Date(),
      });
      setNewPostHeading("");
      setNewPostText("");
    } catch (error) {
      console.error("Error creating post:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, "community_posts")); // Add orderBy if you have an index, else sort client side
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedPosts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CommunityPost[];
        // Sort client side to avoid needing composite index immediately
        fetchedPosts.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });
        setPosts(fetchedPosts);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching community posts:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div
        className={`p-6 rounded-2xl border ${currentTheme.border} ${currentTheme.bg} bg-opacity-50 flex justify-between items-center`}
      >
        <div>
          <h2 className="text-2xl font-bold mb-2 text-white">Community</h2>
          <p className="text-white/70">
            Welcome to the community! Stay updated with the latest announcements.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => {
              // We need a way to navigate to admin panel -> roles
              // Since setActiveTab is not passed to CommunityTab, we can dispatch a custom event or pass it as a prop.
              // For now, let's just use a custom event.
              window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'admin', adminTab: 'roles' } }));
            }}
            className={`${currentTheme.button} ${currentTheme.buttonHover} text-white font-medium py-2 px-4 rounded-xl transition-colors flex items-center gap-2`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Manage Roles
          </button>
        )}
      </div>

      {canCreatePosts && (
        <form onSubmit={handleCreatePost} className={`bg-black/40 p-6 rounded-2xl border ${currentTheme.border} space-y-4`}>
          <h3 className="text-lg font-bold text-white mb-2">Create a Post</h3>
          <input
            type="text"
            value={newPostHeading}
            onChange={(e) => setNewPostHeading(e.target.value)}
            placeholder="Post Heading"
            className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50`}
            required
          />
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 resize-none`}
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50 text-white font-medium py-2 px-6 rounded-xl transition-colors`}
            >
              {isSubmitting ? "Posting..." : "Post to Community"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <CommunityPostCard
            key={post.id}
            post={post}
            currentTheme={currentTheme}
            user={user}
            userProfile={userProfile}
          />
        ))}
        {posts.length === 0 && (
          <div className="text-center p-8 text-white/50 border-2 border-dashed border-white/20 rounded-2xl">
            No posts yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CommunityPostCard({
  post,
  currentTheme,
  user,
  userProfile,
}: {
  key?: string;
  post: CommunityPost;
  currentTheme: any;
  user: any;
  userProfile: any;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (post.soundUrl && audioRef.current) {
      audioRef.current.play().catch((e) => console.log("Autoplay blocked", e));
    }
  }, [post.soundUrl]);

  const handleLike = async () => {
    if (!user) return;
    const postRef = doc(db, "community_posts", post.id);
    const likes = post.likes || [];
    const userId = user.uid || user;

    if (likes.includes(userId)) {
      await updateDoc(postRef, {
        likes: likes.filter((id) => id !== userId),
      });
    } else {
      await updateDoc(postRef, {
        likes: [...likes, userId],
      });
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;

    const postRef = doc(db, "community_posts", post.id);
    const comments = post.comments || [];
    const newComment = {
      id: Date.now().toString(),
      text: commentText,
      authorId: user.uid || user,
      authorName: userProfile?.displayName || "User",
      createdAt: new Date(),
    };

    await updateDoc(postRef, {
      comments: [...comments, newComment],
    });
    setCommentText("");
  };

  const userId = user?.uid || user;
  const isLiked = post.likes?.includes(userId);

  return (
    <div
      className={`p-6 rounded-2xl border ${currentTheme.border} bg-black/20 backdrop-blur-sm overflow-hidden relative`}
    >
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {post.authorName ? post.authorName.charAt(0).toUpperCase() : "A"}
        </div>
        <div>
          <div className="font-semibold text-white flex items-center gap-2">
            {post.authorName || "Unknown"}
            {post.authorRoleName && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] uppercase tracking-wider border border-indigo-500/30">
                {post.authorRoleName}
              </span>
            )}
          </div>
          <div className="text-xs text-white/50">
            {post.createdAt?.toDate
              ? post.createdAt.toDate().toLocaleString()
              : "Just now"}
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold mb-3 text-white">{post.heading}</h3>
      <p className="whitespace-pre-wrap mb-4 text-white/90">{post.text}</p>

      {post.imageUrl && (
        <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
          <img
            src={post.imageUrl}
            alt="Post attachment"
            className="w-full max-h-96 object-cover"
          />
        </div>
      )}

      {post.soundUrl && (
        <div className="mt-4">
          <audio
            ref={audioRef}
            controls
            src={post.soundUrl}
            className="w-full h-10 rounded-lg opacity-80"
          />
        </div>
      )}

      <div className="mt-6 flex items-center gap-4 border-t border-white/10 pt-4">
        <button
          onClick={handleLike}
          className={`flex items-center gap-2 text-sm transition-colors ${isLiked ? "text-rose-400" : "text-white/60 hover:text-white"}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill={isLiked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          {post.likes?.length || 0} Likes
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
          </svg>
          {post.comments?.length || 0} Comments
        </button>
      </div>

      {showComments && (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {post.comments?.map((comment) => (
            <div key={comment.id} className="bg-black/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-white">
                  {comment.authorName}
                </span>
                <span className="text-xs text-white/40">
                  {comment.createdAt?.toDate
                    ? comment.createdAt.toDate().toLocaleString()
                    : "Just now"}
                </span>
              </div>
              <p className="text-sm text-white/80">{comment.text}</p>
            </div>
          ))}

          <form onSubmit={handleComment} className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30`}
            />
            <button
              type="submit"
              disabled={!commentText.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50`}
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

interface AdminPopup {
  id: string;
  type?: 'regular' | 'update' | 'proday';
  target: 'all' | 'role' | 'user';
  targetId?: string;
  heading: string;
  text: string;
  imageUrl?: string;
  soundUrl?: string;
  videoUrl?: string;
  buttonText?: string;
  createdAt: any;
}

function AdminPopupsTab({ currentTheme, allRoles }: { currentTheme: any, allRoles: Role[] }) {
  const [type, setType] = useState<'regular' | 'update'>('regular');
  const [target, setTarget] = useState<'all' | 'role' | 'user'>('all');
  const [targetId, setTargetId] = useState('');
  const [heading, setHeading] = useState('');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [soundUrl, setSoundUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [popups, setPopups] = useState<AdminPopup[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'popups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPopups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminPopup)));
    });
    return () => unsubscribe();
  }, []);

  const handleDeletePopup = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'popups', id));
      setMessage('Popup deleted successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error deleting popup:", error);
      setMessage('Failed to delete popup.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'sound') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadError('');

    try {
      const base64 = await fileToBase64(file);
      if (type === 'image') {
        setImageUrl(base64);
      } else {
        setSoundUrl(base64);
      }
    } catch (err) {
      setUploadError('Failed to read file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heading || !text) return;
    if (target !== 'all' && !targetId) {
      setMessage('Please specify a target ID');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'popups'), {
        type,
        target,
        targetId: target !== 'all' ? targetId : null,
        heading,
        text,
        imageUrl,
        soundUrl,
        videoUrl,
        buttonText,
        createdAt: new Date()
      });
      setHeading('');
      setText('');
      setImageUrl('');
      setSoundUrl('');
      setVideoUrl('');
      setButtonText('');
      setMessage('Popup sent successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("Error creating popup:", error);
      setMessage('Failed to send popup.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}>
        <h3 className="text-xl font-bold mb-6 text-white">Send Popup</h3>
        {message && (
          <div className="mb-4 p-3 rounded-xl bg-white/10 text-white text-sm text-center">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Popup Type</label>
          <select value={type} onChange={e => setType(e.target.value as any)} className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}>
            <option value="regular">Regular Popup</option>
            <option value="update">Update Popup (Changelog)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Target Audience</label>
          <select value={target} onChange={e => setTarget(e.target.value as any)} className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}>
            <option value="all">Everyone</option>
            <option value="role">Specific Role</option>
            <option value="user">Specific User (UID)</option>
          </select>
        </div>
        
        {target === 'role' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Select Role</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} required className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}>
              <option value="">-- Select a Role --</option>
              {allRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}

        {target === 'user' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">User ID</label>
            <input type="text" value={targetId} onChange={e => setTargetId(e.target.value)} required placeholder="Paste User UID here..." className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`} />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Heading</label>
          <input type="text" value={heading} onChange={e => setHeading(e.target.value)} required className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`} placeholder={type === 'update' ? "e.g. Updates" : "Popup heading..."} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Text</label>
          <textarea value={text} onChange={e => setText(e.target.value)} required rows={4} className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors resize-none`} placeholder={type === 'update' ? "- Added new feature\n- Fixed bug" : "Popup content..."} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Image (Optional)</label>
          <div className="flex gap-4 items-center">
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20`} />
            <span className="text-white/40 text-sm">OR</span>
            <input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`} placeholder="Image URL..." />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Background Music/Sound (Optional)</label>
          <div className="flex gap-4 items-center">
            <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'sound')} className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20`} />
            <span className="text-white/40 text-sm">OR</span>
            <input type="url" value={soundUrl} onChange={e => setSoundUrl(e.target.value)} className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`} placeholder="Sound URL..." />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">Video URL (Optional)</label>
          <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`} placeholder="YouTube, Vimeo, or direct video URL..." />
        </div>
        {type === 'regular' && (
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Custom Button Text (Optional)</label>
            <input type="text" value={buttonText} onChange={e => setButtonText(e.target.value)} className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`} placeholder="e.g. Got it!, Dismiss, Awesome!" />
          </div>
        )}
        {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}
        <div className="pt-4">
          <button type="submit" disabled={isSubmitting} className={`w-full py-3 rounded-xl font-medium transition-all ${currentTheme.button} ${currentTheme.buttonHover} text-white disabled:opacity-50`}>
            {isSubmitting ? 'Sending...' : 'Send Popup'}
          </button>
        </div>
      </form>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}>
        <h3 className="text-xl font-bold mb-6 text-white">Active Popups</h3>
        {popups.length === 0 ? (
          <p className="text-white/50 text-center py-4">No popups found.</p>
        ) : (
          <div className="space-y-4">
            {popups.map(popup => (
              <div key={popup.id} className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h4 className="font-semibold text-white">{popup.heading}</h4>
                  <p className="text-sm text-white/60 mt-1 line-clamp-2">{popup.text}</p>
                  <div className="mt-2 text-xs text-white/40">
                    Target: {popup.target === 'all' ? 'Everyone' : popup.target === 'role' ? `Role ID: ${popup.targetId}` : `User ID: ${popup.targetId}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDeletePopup(popup.id)}
                  className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Delete Popup
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function AdminCreatePostTab({
  currentTheme,
  user,
  userProfile,
  allRoles,
}: {
  currentTheme: any;
  user: any;
  userProfile: any;
  allRoles: Role[];
}) {
  const [heading, setHeading] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [soundUrl, setSoundUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "sound",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");

    try {
      const base64 = await fileToBase64(file);
      if (type === "image") {
        setImageUrl(base64);
      } else {
        setSoundUrl(base64);
      }
    } catch (err) {
      setUploadError("Failed to read file.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heading || !text) return;
    setIsSubmitting(true);
    try {
      const userRole = allRoles.find((r) => r.id === userProfile?.roleId);
      const authorRoleName = userRole
        ? userRole.name
        : userProfile?.displayName?.toLowerCase().includes("markustheadmin")
          ? "Super Admin"
          : "Admin";

      await addDoc(collection(db, "community_posts"), {
        heading,
        text,
        imageUrl,
        soundUrl,
        authorId: user.uid || user,
        authorName: userProfile?.displayName || user.displayName || "Admin",
        authorRoleName,
        createdAt: new Date(), // Use client date for immediate sorting, or serverTimestamp if imported
      });
      setHeading("");
      setText("");
      setImageUrl("");
      setSoundUrl("");
      alert("Post created successfully!");
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Failed to create post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <h3 className="text-xl font-bold mb-6 text-white">
        Create Community Post
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">
            Heading
          </label>
          <input
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            required
            className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}
            placeholder="Post heading..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">
            Text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={5}
            className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors resize-none`}
            placeholder="Post content..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">
            Image (Optional)
          </label>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, "image")}
              className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20`}
            />
            <span className="text-white/40 text-sm">OR</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}
              placeholder="Image URL..."
            />
          </div>
          {imageUrl && imageUrl.startsWith("data:image") && (
            <div className="mt-2 text-xs text-green-400">
              Image loaded from file
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-white/80">
            Sound/Music (Optional)
          </label>
          <div className="flex gap-4 items-center">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileUpload(e, "sound")}
              className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20`}
            />
            <span className="text-white/40 text-sm">OR</span>
            <input
              type="url"
              value={soundUrl}
              onChange={(e) => setSoundUrl(e.target.value)}
              className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}
              placeholder="Sound URL..."
            />
          </div>
          {soundUrl && soundUrl.startsWith("data:audio") && (
            <div className="mt-2 text-xs text-green-400">
              Audio loaded from file
            </div>
          )}
          <p className="text-xs text-white/40 mt-2">
            This sound will play when users view the post.
          </p>
        </div>
        {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-medium transition-all ${currentTheme.button} ${currentTheme.buttonHover} text-white disabled:opacity-50`}
          >
            {isSubmitting ? "Posting..." : "Create Post"}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function AdminRolesTab({
  currentTheme,
  allRoles,
}: {
  currentTheme: any;
  allRoles: Role[];
}) {
  const [newRoleName, setNewRoleName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availablePermissions = [
    { id: "admin_panel", label: "Access Admin Panel" },
    { id: "manage_roles", label: "Manage Roles" },
    { id: "manage_users", label: "Manage Users" },
    { id: "create_posts", label: "Create Community Posts" },
    { id: "edit_credits", label: "Edit Credits & Settings" },
    { id: "view_community", label: "View Community" },
  ];

  const handleTogglePermission = (permId: string) => {
    setPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId],
    );
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "roles"), {
        name: newRoleName,
        permissions,
      });
      setNewRoleName("");
      setPermissions([]);
    } catch (error) {
      console.error("Error creating role:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await deleteDoc(doc(db, "roles", roleId));
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
      >
        <h3 className="text-xl font-bold mb-6 text-white">Create New Role</h3>
        <form onSubmit={handleCreateRole} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">
              Role Name
            </label>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              required
              className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition-colors`}
              placeholder="e.g., Community Typer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-3 text-white/80">
              Permissions
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availablePermissions.map((perm) => (
                <label
                  key={perm.id}
                  className={`flex items-center space-x-3 p-3 rounded-xl border transition-colors cursor-pointer ${permissions.includes(perm.id) ? "bg-white/10 border-white/30" : "bg-black/40 border-white/5 hover:bg-black/60"}`}
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => handleTogglePermission(perm.id)}
                    className="rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-white/90">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 rounded-xl font-medium transition-all ${currentTheme.button} ${currentTheme.buttonHover} text-white disabled:opacity-50`}
          >
            {isSubmitting ? "Creating..." : "Create Role"}
          </button>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
      >
        <h3 className="text-xl font-bold mb-6 text-white">Existing Roles</h3>
        <div className="space-y-3">
          {allRoles.map((role) => (
            <div
              key={role.id}
              className={`flex items-center justify-between p-4 rounded-xl bg-black/40 border ${currentTheme.border}`}
            >
              <div>
                <div className="font-semibold text-white">{role.name}</div>
                <div className="text-xs text-white/50 mt-1">
                  {role.permissions.join(", ") || "No permissions"}
                </div>
              </div>
              <button
                onClick={() => handleDeleteRole(role.id)}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          {allRoles.length === 0 && (
            <div className="text-sm text-white/50 text-center p-4">
              No custom roles created yet.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AdminUsersTab({
  currentTheme,
  allRoles,
}: {
  currentTheme: any;
  allRoles: Role[];
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyOnRoleChange, setNotifyOnRoleChange] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        roleId: roleId === "none" ? deleteField() : roleId,
      });
      
      if (notifyOnRoleChange) {
        const newRole = allRoles.find(r => r.id === roleId);
        const roleName = newRole ? newRole.name : (roleId === "none" ? "Regular User" : "Unknown Role");
        await addDoc(collection(db, "popups"), {
          type: "regular",
          target: "user",
          targetId: userId,
          heading: "Role Updated",
          message: `Your role has been updated to: ${roleName}`,
          imageUrl: "",
          soundUrl: "",
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error updating user role:", error);
    }
  };

  if (loading)
    return (
      <div className="text-center text-white/60 p-8">Loading users...</div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">Manage Users</h3>
        <label className="flex items-center space-x-2 text-sm text-white/80 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyOnRoleChange}
            onChange={(e) => setNotifyOnRoleChange(e.target.checked)}
            className="rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500"
          />
          <span>Notify user on role change</span>
        </label>
      </div>
      <div className="space-y-3">
        {users.map((u) => {
          const uRole = allRoles.find((r) => r.id === u.roleId);
          const roleName = uRole
            ? uRole.name
            : u.displayName?.toLowerCase().includes("markustheadmin")
              ? "Super Admin"
              : "Regular User";
          return (
            <div
              key={u.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-black/40 border ${currentTheme.border} gap-4`}
            >
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    {(u.isOnline && u.lastActive && new Date().getTime() - u.lastActive < 120000) ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500"></span>
                    )}
                  </div>
                  {u.displayName || "Unknown User"}
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] uppercase tracking-wider border border-indigo-500/30">
                    {roleName}
                  </span>
                </div>
                <div className="text-xs text-white/50 flex items-center gap-2 mt-1">
                  <span>{u.id}</span>
                  <span>•</span>
                  <span>Last active: {u.lastActive ? new Date(u.lastActive).toLocaleString() : "Unknown"}</span>
                </div>
              </div>
              <select
                value={u.roleId || "none"}
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                className={`bg-black/60 border ${currentTheme.border} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30`}
              >
                <option value="none">Regular User</option>
                {allRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
function AdminAnalyticsTab({ currentTheme }: { currentTheme: any }) {
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'popup_analytics'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
      setAnalytics(data);
    });

    const usersQ = query(collection(db, 'users'), orderBy('timeSpent', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return <div className="text-white text-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}>
        <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <Users size={24} className="text-indigo-400" /> User Engagement
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-white/80">
            <thead>
              <tr className="border-b border-white/10">
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Time Spent</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 font-medium text-white">{u.displayName || "Unknown User"}</td>
                  <td className="py-3 font-mono text-indigo-300">{formatTime(u.timeSpent || 0)}</td>
                  <td className="py-3">
                    {u.isOnline ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">Online</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/10 text-white/50">Offline</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-white/50">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}>
        <h3 className="text-xl font-bold mb-6 text-white">Popup Analytics</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-white/80">
            <thead>
              <tr className="border-b border-white/10">
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">User</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Popup ID</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 text-sm">{entry.timestamp?.toLocaleString()}</td>
                  <td className="py-3">{entry.userName}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${entry.action === 'click' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
                      {entry.action.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 text-sm font-mono text-white/50">{entry.popupId}</td>
                </tr>
              ))}
              {analytics.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-white/50">No analytics data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function AdminProDayTab({
  currentTheme,
  allRoles,
}: {
  currentTheme: any;
  allRoles: Role[];
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [proDayName, setProDayName] = useState("ProDay");
  const [notifyOnUnlock, setNotifyOnUnlock] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUnlockProDay = async (userId: string, unlock: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        proDayUnlocked: unlock,
        proDayName: proDayName,
        ...(unlock ? {} : { proDayActive: false }) // Disable if locked
      });
      
      if (unlock && notifyOnUnlock) {
        await addDoc(collection(db, "popups"), {
          type: "proday",
          target: "user",
          targetId: userId,
          heading: "ProDay Unlocked!",
          message: `An admin sent you ${proDayName}, the best version of MySchoolDay with premium perks.`,
          imageUrl: "",
          soundUrl: "",
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error updating ProDay status:", error);
    }
  };

  const handleUnlockAll = async (unlock: boolean) => {
    if (!confirm(`Are you sure you want to ${unlock ? 'unlock' : 'lock'} ${proDayName} for ALL users?`)) return;
    for (const u of users) {
      await handleUnlockProDay(u.id, unlock);
    }
  };

  if (loading)
    return (
      <div className="text-center text-white/60 p-8">Loading users...</div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <div className="mb-8 p-6 bg-black/40 rounded-2xl border border-white/10">
        <h3 className="text-xl font-bold text-white mb-4">ProDay Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">Rename ProDay</label>
            <input
              type="text"
              value={proDayName}
              onChange={(e) => setProDayName(e.target.value)}
              className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <label className="flex items-center space-x-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyOnUnlock}
              onChange={(e) => setNotifyOnUnlock(e.target.checked)}
              className="rounded border-white/20 bg-black/20 text-indigo-500 focus:ring-indigo-500"
            />
            <span>Send golden popup notification on unlock</span>
          </label>
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => handleUnlockAll(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium"
            >
              Unlock for ALL Users
            </button>
            <button
              onClick={() => handleUnlockAll(false)}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-700/80 text-white rounded-xl transition-colors font-medium"
            >
              Lock for ALL Users
            </button>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-white mb-4">Manage Access</h3>
      <div className="space-y-3">
        {users.map((u) => {
          return (
            <div
              key={u.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-black/40 border ${currentTheme.border} gap-4`}
            >
              <div>
                <div className="font-semibold text-white flex items-center gap-2">
                  {u.displayName || "Unknown User"}
                  {u.proDayUnlocked && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase tracking-wider border border-amber-500/30">
                      Unlocked
                    </span>
                  )}
                  {u.proDayActive && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] uppercase tracking-wider border border-emerald-500/30">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {u.id}
                </div>
              </div>
              <div className="flex gap-2">
                {u.proDayUnlocked ? (
                  <button
                    onClick={() => handleUnlockProDay(u.id, false)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                  >
                    Revoke / Cancel
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnlockProDay(u.id, true)}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm transition-colors"
                  >
                    Send ProDay
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function AdminAgendaTab({
  currentTheme,
  agendaText,
  agendaVisibility,
  tabsVisibility,
}: {
  currentTheme: any;
  agendaText: string;
  agendaVisibility: string;
  tabsVisibility: Record<string, boolean>;
}) {
  const [newAgenda, setNewAgenda] = useState(agendaText);
  const [newVisibility, setNewVisibility] = useState(agendaVisibility);
  const [newTabsVisibility, setNewTabsVisibility] = useState(tabsVisibility);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "global"),
        { agendaText: newAgenda, agendaVisibility: newVisibility, tabsVisibility: newTabsVisibility },
        { merge: true },
      );
    } catch (e) {
      // Ignore
    }
    setSaving(false);
  };

  const toggleTab = (tab: string) => {
    setNewTabsVisibility(prev => ({
      ...prev,
      [tab]: prev[tab] === false ? true : false
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <h2 className="text-2xl font-bold text-white mb-6">Agenda & Navigation Settings</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Main Navigation Tabs</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {['schedule', 'homework', 'calculator', 'notes', 'community', 'awards', 'agenda'].map(tab => (
              <button
                key={tab}
                onClick={() => toggleTab(tab)}
                className={`px-4 py-3 rounded-xl transition-colors flex items-center justify-between ${newTabsVisibility[tab] !== false ? currentTheme.button + " text-white" : "bg-black/40 text-white/50"}`}
              >
                <span className="capitalize">{tab}</span>
                {newTabsVisibility[tab] !== false ? <Check size={16} /> : <X size={16} />}
              </button>
            ))}
          </div>
          <p className="text-sm text-white/50 mt-2">Toggle which tabs are visible to users in the main navigation.</p>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Agenda Content
          </label>
          <textarea
            value={newAgenda}
            onChange={(e) => setNewAgenda(e.target.value)}
            className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors min-h-[150px]`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-2">
            Visibility on Homepage
          </label>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setNewVisibility("hidden")}
              className={`px-4 py-2 rounded-xl transition-colors ${newVisibility === "hidden" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70"}`}
            >
              Hidden
            </button>
            <button
              onClick={() => setNewVisibility("snippet")}
              className={`px-4 py-2 rounded-xl transition-colors ${newVisibility === "snippet" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70"}`}
            >
              Snippet Only
            </button>
            <button
              onClick={() => setNewVisibility("full")}
              className={`px-4 py-2 rounded-xl transition-colors ${newVisibility === "full" ? currentTheme.button + " text-white" : "bg-black/40 text-white/70"}`}
            >
              Full Agenda
            </button>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full ${currentTheme.button} ${currentTheme.buttonHover} text-white font-semibold py-3 px-4 rounded-xl transition-colors`}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </motion.div>
  );
}

function AdminSettingsTab({
  currentTheme,
  footerText,
  creditsText,
}: {
  currentTheme: any;
  footerText: string;
  creditsText: string;
}) {
  const [newFooter, setNewFooter] = useState(footerText);
  const [newCredits, setNewCredits] = useState(creditsText);
  const [saving, setSaving] = useState(false);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "global"),
        { footerText: newFooter, creditsText: newCredits },
        { merge: true },
      );
    } catch (e) {
      // Ignore
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <LayoutDashboard className="text-rose-400" />
        Global Settings
      </h2>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium text-white/80 mb-4">
            Edit Footer Text
          </h3>
          <input
            type="text"
            value={newFooter}
            onChange={(e) => setNewFooter(e.target.value)}
            className={`w-full bg-black/40 border ${currentTheme.border} rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors`}
          />
        </div>
        <div>
          <h3 className="text-lg font-medium text-white/80 mb-4">
            Edit Credits Text
          </h3>
          <textarea
            value={newCredits}
            onChange={(e) => setNewCredits(e.target.value)}
            className={`w-full h-24 bg-black/40 border ${currentTheme.border} rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors resize-none`}
          />
        </div>
      </div>

      <div className="mb-8">
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className={`${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50 text-white font-medium py-2 px-6 rounded-xl transition-colors`}
        >
          {saving ? "Saving..." : "Save Global Settings"}
        </button>
      </div>

      <div className="mt-12 space-y-6">
        <div
          className={`p-6 rounded-2xl border ${currentTheme.border} bg-black/20 backdrop-blur-sm`}
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className={`p-2 rounded-lg ${currentTheme.button} bg-opacity-20`}>
              <Info className={`w-5 h-5 ${currentTheme.text}`} />
            </div>
            <h3 className="text-lg font-semibold text-white">Versions</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
              <div>
                <div className="font-medium text-white">Version 1</div>
                <div className="text-xs text-white/50">Original GitHub Version</div>
              </div>
              <div className="flex gap-2">
                <a href="https://github.com/reidzvlogs-lab/MySchoolDay" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">Review</a>
                <a href="https://github.com/reidzvlogs-lab/MySchoolDay" target="_blank" rel="noopener noreferrer" className={`px-3 py-1.5 rounded-lg ${currentTheme.button} ${currentTheme.buttonHover} text-white text-sm transition-colors`}>Return</a>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
              <div>
                <div className="font-medium text-white">Version 2 (Current)</div>
                <div className="text-xs text-white/50">Latest Updates</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">Review</button>
                <button onClick={() => window.location.reload()} className={`px-3 py-1.5 rounded-lg ${currentTheme.button} ${currentTheme.buttonHover} text-white text-sm transition-colors`}>Return</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SettingsTab({
  user,
  userProfile,
  userClasses,
  setUserClasses,
  currentTheme,
  footerText,
  creditsText,
  setActiveTab,
  setLocalTheme,
  isSuperAdmin,
}: {
  user: string | null;
  userProfile: any;
  userClasses: Record<string, string>;
  setUserClasses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  currentTheme: any;
  footerText: string;
  creditsText: string;
  setActiveTab: (tab: string) => void;
  setLocalTheme: (theme: string) => void;
  isSuperAdmin: boolean;
}) {
  const [classes, setClasses] = useState<Record<string, string>>(userClasses);
  const [theme, setTheme] = useState<string>(userProfile?.theme || "slate");
  const [saving, setSaving] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [activeCustomization, setActiveCustomization] = useState<string | null>(null);
  
  const [customColors, setCustomColors] = useState({ 
    bg: userProfile?.customColors?.bg || "#0f172a", 
    text: userProfile?.customColors?.text || "#f8fafc", 
    button: userProfile?.customColors?.button || "#6366f1" 
  });
  const [liquidGlass, setLiquidGlass] = useState(userProfile?.liquidGlass || false);
  const [namePlate, setNamePlate] = useState(userProfile?.namePlate || 'classic');
  const [profilePicStyle, setProfilePicStyle] = useState(userProfile?.profilePicStyle || 'initials');

  const handleThemeChange = async (t: string) => {
    setTheme(t);
    setLocalTheme(t);
    if (user) {
      try {
        await updateDoc(doc(db, "users", user), { theme: t });
      } catch (error) {
        // Ignore
      }
    }
  };

  const handleSaveCustomizations = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user), {
        customColors,
        liquidGlass,
        namePlate,
        profilePicStyle
      });
    } catch (error) {
      console.error("Error saving customizations:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (user) {
      try {
        await updateDoc(doc(db, "users", user), { classes });
        setUserClasses(classes);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user}`);
      }
    } else {
      setUserClasses(classes);
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-black/20 backdrop-blur-sm p-6 md:p-8 rounded-3xl border ${currentTheme.border}`}
    >
      <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

      <div className="mb-8">
        <h3 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
          {userProfile?.proDayActive ? (userProfile?.proDayName || "ProDay") : "ProDay"}
          {!(userProfile?.proDayUnlocked || isSuperAdmin) && <Shield size={16} className="text-white/50" />}
        </h3>
        {(userProfile?.proDayUnlocked || isSuperAdmin) ? (
          <div className="space-y-4">
            <button
              onClick={async () => {
                if (user) {
                  await updateDoc(doc(db, "users", user), { proDayActive: !userProfile?.proDayActive });
                }
              }}
              className={`w-full relative overflow-hidden p-6 rounded-2xl border-2 transition-all duration-500 ${
                userProfile?.proDayActive 
                  ? "bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.3)]" 
                  : "bg-black/40 border-white/10 hover:border-amber-500/50 hover:bg-black/60"
              }`}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="text-left">
                  <div className={`text-2xl font-bold mb-1 ${userProfile?.proDayActive ? "text-white" : "text-amber-500"}`}>
                    {userProfile?.proDayActive ? `${userProfile?.proDayName || "ProDay"} Active` : `Enable ProDay`}
                  </div>
                  <div className={userProfile?.proDayActive ? "text-amber-100" : "text-white/50"}>
                    Experience liquid glass and premium perks
                  </div>
                </div>
                <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${userProfile?.proDayActive ? "bg-amber-300/30" : "bg-white/10"}`}>
                  <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${userProfile?.proDayActive ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </div>
              {userProfile?.proDayActive && (
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_3s_infinite]" />
              )}
            </button>
            
            {userProfile?.proDayActive && (
              <div className="bg-black/40 p-6 rounded-2xl border border-amber-500/30 space-y-4 shadow-lg shadow-amber-500/10">
                <div className="text-amber-400 font-bold text-lg mb-4">ProDay Customization</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <button 
                     onClick={() => setActiveCustomization(activeCustomization === 'liquid' ? null : 'liquid')}
                     className={`py-3 px-4 bg-gradient-to-r from-amber-500/10 to-yellow-600/10 hover:from-amber-500/20 hover:to-yellow-600/20 border ${activeCustomization === 'liquid' ? 'border-amber-400' : 'border-amber-500/20'} rounded-xl text-amber-100 font-medium transition-all text-left flex items-center justify-between`}
                   >
                     <span>Liquid Glass Theme</span>
                     <ChevronRight size={16} className={`text-amber-500 transition-transform ${activeCustomization === 'liquid' ? 'rotate-90' : ''}`} />
                   </button>
                   <button 
                     onClick={() => setActiveCustomization(activeCustomization === 'colors' ? null : 'colors')}
                     className={`py-3 px-4 bg-gradient-to-r from-amber-500/10 to-yellow-600/10 hover:from-amber-500/20 hover:to-yellow-600/20 border ${activeCustomization === 'colors' ? 'border-amber-400' : 'border-amber-500/20'} rounded-xl text-amber-100 font-medium transition-all text-left flex items-center justify-between`}
                   >
                     <span>Custom Colors</span>
                     <ChevronRight size={16} className={`text-amber-500 transition-transform ${activeCustomization === 'colors' ? 'rotate-90' : ''}`} />
                   </button>
                   <button 
                     onClick={() => setActiveCustomization(activeCustomization === 'nameplates' ? null : 'nameplates')}
                     className={`py-3 px-4 bg-gradient-to-r from-amber-500/10 to-yellow-600/10 hover:from-amber-500/20 hover:to-yellow-600/20 border ${activeCustomization === 'nameplates' ? 'border-amber-400' : 'border-amber-500/20'} rounded-xl text-amber-100 font-medium transition-all text-left flex items-center justify-between`}
                   >
                     <span>Name Plates</span>
                     <ChevronRight size={16} className={`text-amber-500 transition-transform ${activeCustomization === 'nameplates' ? 'rotate-90' : ''}`} />
                   </button>
                   <button 
                     onClick={() => setActiveCustomization(activeCustomization === 'profilepic' ? null : 'profilepic')}
                     className={`py-3 px-4 bg-gradient-to-r from-amber-500/10 to-yellow-600/10 hover:from-amber-500/20 hover:to-yellow-600/20 border ${activeCustomization === 'profilepic' ? 'border-amber-400' : 'border-amber-500/20'} rounded-xl text-amber-100 font-medium transition-all text-left flex items-center justify-between`}
                   >
                     <span>Profile Picture</span>
                     <ChevronRight size={16} className={`text-amber-500 transition-transform ${activeCustomization === 'profilepic' ? 'rotate-90' : ''}`} />
                   </button>
                </div>
                
                {activeCustomization === 'liquid' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-amber-500/20">
                    <p className="text-amber-200/80 text-sm mb-4">Enable the premium liquid glass style for buttons and cards.</p>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={liquidGlass}
                        onChange={(e) => {
                          setLiquidGlass(e.target.checked);
                          if (user) updateDoc(doc(db, "users", user), { liquidGlass: e.target.checked });
                        }}
                        className="rounded border-amber-500/50 bg-black/40 text-amber-500 focus:ring-amber-500" 
                      />
                      <span className="text-amber-100">Use Liquid Glass Style</span>
                    </label>
                  </motion.div>
                )}
                
                {activeCustomization === 'colors' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-amber-500/20">
                    <p className="text-amber-200/80 text-sm mb-4">Choose your own custom colors for the website.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-amber-200/60 mb-1">Background</label>
                        <input type="color" value={customColors.bg} onChange={(e) => setCustomColors({...customColors, bg: e.target.value})} className="w-full h-10 rounded cursor-pointer bg-transparent border-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-amber-200/60 mb-1">Text</label>
                        <input type="color" value={customColors.text} onChange={(e) => setCustomColors({...customColors, text: e.target.value})} className="w-full h-10 rounded cursor-pointer bg-transparent border-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-amber-200/60 mb-1">Buttons</label>
                        <input type="color" value={customColors.button} onChange={(e) => setCustomColors({...customColors, button: e.target.value})} className="w-full h-10 rounded cursor-pointer bg-transparent border-none" />
                      </div>
                    </div>
                    <button onClick={handleSaveCustomizations} className="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm transition-colors w-full">Apply Custom Colors</button>
                  </motion.div>
                )}
                
                {activeCustomization === 'nameplates' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-amber-500/20">
                    <p className="text-amber-200/80 text-sm mb-4">Choose a premium name plate style for your profile.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setNamePlate('golden'); if (user) updateDoc(doc(db, "users", user), { namePlate: 'golden' }); }} className={`py-2 px-3 border ${namePlate === 'golden' ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-amber-500/30'} bg-gradient-to-r from-yellow-400/20 to-amber-600/20 rounded-lg text-amber-200 text-sm`}>Golden Plated</button>
                      <button onClick={() => { setNamePlate('silver'); if (user) updateDoc(doc(db, "users", user), { namePlate: 'silver' }); }} className={`py-2 px-3 border ${namePlate === 'silver' ? 'border-slate-300 ring-2 ring-slate-300/50' : 'border-slate-400/30'} bg-gradient-to-r from-slate-300/20 to-slate-500/20 rounded-lg text-slate-200 text-sm`}>Silver Plated</button>
                      <button onClick={() => { setNamePlate('liquid'); if (user) updateDoc(doc(db, "users", user), { namePlate: 'liquid' }); }} className={`py-2 px-3 border ${namePlate === 'liquid' ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-indigo-500/30'} bg-gradient-to-r from-indigo-400/20 to-purple-600/20 rounded-lg text-indigo-200 text-sm`}>Liquid Glass</button>
                      <button onClick={() => { setNamePlate('classic'); if (user) updateDoc(doc(db, "users", user), { namePlate: 'classic' }); }} className={`py-2 px-3 border ${namePlate === 'classic' ? 'border-white/30 ring-2 ring-white/20' : 'border-white/10'} bg-black/40 rounded-lg text-white/70 text-sm`}>Classic</button>
                    </div>
                  </motion.div>
                )}
                
                {activeCustomization === 'profilepic' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 border-t border-amber-500/20">
                    <p className="text-amber-200/80 text-sm mb-4">Customize your profile picture icon.</p>
                    <div className="flex gap-4">
                      <button onClick={() => { setProfilePicStyle('initials'); if (user) updateDoc(doc(db, "users", user), { profilePicStyle: 'initials' }); }} className={`w-12 h-12 rounded-full bg-amber-500/20 border ${profilePicStyle === 'initials' ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-amber-500/50'} flex items-center justify-center text-amber-300 hover:bg-amber-500/30 transition-colors`}>
                        <span className="text-xl font-bold">{userProfile?.name?.charAt(0) || 'A'}</span>
                      </button>
                      <button onClick={() => { setProfilePicStyle('crown'); if (user) updateDoc(doc(db, "users", user), { profilePicStyle: 'crown' }); }} className={`w-12 h-12 rounded-full bg-amber-500/20 border ${profilePicStyle === 'crown' ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-amber-500/50'} flex items-center justify-center text-amber-300 hover:bg-amber-500/30 transition-colors`}>
                        <span className="text-xl">👑</span>
                      </button>
                      <button onClick={() => { setProfilePicStyle('sunglasses'); if (user) updateDoc(doc(db, "users", user), { profilePicStyle: 'sunglasses' }); }} className={`w-12 h-12 rounded-full bg-amber-500/20 border ${profilePicStyle === 'sunglasses' ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-amber-500/50'} flex items-center justify-center text-amber-300 hover:bg-amber-500/30 transition-colors`}>
                        <span className="text-xl">😎</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex items-center justify-between opacity-50">
            <div className="text-white/70">
              <div className="font-medium">ProDay is locked</div>
              <div className="text-sm">Unlock premium perks and themes</div>
            </div>
            <Shield size={24} className="text-white/30" />
          </div>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-medium text-white/80 mb-4">Your Theme</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            "slate", "indigo", "emerald", "rose", "light", "dark", "whitish", "darkish",
            ...(userProfile?.proDayActive ? ["ocean", "sunset", "forest", "neon", "midnight", "custom"] : [])
          ].map((t) => (
            <button
              key={t}
              onClick={() => handleThemeChange(t)}
              className={`py-3 rounded-xl font-medium capitalize transition-colors border-2 ${theme === t ? "border-white bg-white/20" : "border-transparent bg-black/40 hover:bg-black/60"} text-white`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-medium text-white/80 mb-4">Your Classes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["1", "2", "3A", "3B", "4A", "4B", "5", "6", "7", "8"].map(
            (period) => (
              <div key={period} className="flex items-center gap-3">
                <div className="w-16 text-right text-white/60 font-mono text-sm">
                  Period {period}
                </div>
                <input
                  type="text"
                  value={classes[period] || ""}
                  onChange={(e) =>
                    setClasses({ ...classes, [period]: e.target.value })
                  }
                  className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 transition-colors`}
                />
              </div>
            ),
          )}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50 text-white font-medium py-2 px-6 rounded-xl transition-colors`}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      <div className="mt-12 space-y-6">
        <div className="text-center text-white/40 text-sm flex flex-col items-center">
          {footerText}
          <div className="mt-2 flex gap-4">
            <button
              onClick={() => setShowCredits(!showCredits)}
              className="underline hover:text-white/60 transition-colors"
            >
              Credits
            </button>
            <button
              onClick={() => setActiveTab("community")}
              className="underline hover:text-white/60 transition-colors"
            >
              Community
            </button>
            <button
              onClick={() => setActiveTab("awards")}
              className="underline hover:text-white/60 transition-colors"
            >
              Awards
            </button>
          </div>
          {showCredits && creditsText && (
            <div className="mt-4 p-4 bg-black/40 rounded-xl text-left whitespace-pre-wrap text-white/80 w-full">
              {creditsText}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function OnboardingScreen({ user }: { user: string }) {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classes, setClasses] =
    useState<Record<string, string>>(defaultClasses);
  const [theme, setTheme] = useState("slate");
  const [loading, setLoading] = useState(false);

  const subjects = [
    "Science", "Math", "ELA", "Social Studies", "FACs", 
    "P.E.", "Health", "Art", "PAWS", "Music", 
    "Tech", "Spanish", "French", "Study Hall"
  ];

  const handleDragStart = (e: React.DragEvent, subject: string) => {
    e.dataTransfer.setData("text/plain", subject);
  };

  const handleDrop = (e: React.DragEvent, period: string) => {
    e.preventDefault();
    const subject = e.dataTransfer.getData("text/plain");
    if (subject) {
      setClasses({ ...classes, [period]: subject });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSubjectClick = (subject: string) => {
    const periods = ["1", "2", "3A", "3B", "4A", "4B", "5", "6", "7", "8"];
    const emptyPeriod = periods.find(p => !classes[p]);
    if (emptyPeriod) {
      setClasses({ ...classes, [emptyPeriod]: subject });
    }
  };

  const handleComplete = async () => {
    const isMarkus = firstName.trim().toLowerCase() === "markustheadmin";
    if (!firstName.trim() || (!lastName.trim() && !isMarkus)) return;
    setLoading(true);
    try {
      await setDoc(doc(db, "users", user), {
        uid: user,
        displayName: isMarkus
          ? "markustheadmin"
          : `${firstName.trim()} ${lastName.trim()}`,
        classes: classes,
        theme: theme,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user}`);
      setLoading(false);
    }
  };

  const currentTheme = themeColors[theme] || themeColors.slate;

  if (step === 1) {
    return (
      <div
        className={`min-h-screen ${currentTheme.bg} ${['light', 'whitish'].includes(theme) ? 'invert-text' : ''} flex items-center justify-center p-4 transition-colors duration-500`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-black/20 p-8 rounded-3xl border ${currentTheme.border} max-w-md w-full text-center backdrop-blur-sm`}
        >
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen size={40} className="text-white/80" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to School Day!
          </h1>
          <p className="text-white/60 mb-8">
            Let's get you set up. What is your name?
          </p>

          <div className="space-y-4 mb-6">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors text-center text-lg`}
              autoFocus
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className={`w-full bg-black/40 border ${currentTheme.border} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors text-center text-lg`}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                firstName.trim() &&
                lastName.trim() &&
                setStep(2)
              }
            />
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!firstName.trim() || !lastName.trim()}
            className={`w-full ${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors`}
          >
            Next
          </button>
        </motion.div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div
        className={`min-h-screen ${currentTheme.bg} flex items-center justify-center p-4 transition-colors duration-500`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-black/20 p-8 rounded-3xl border ${currentTheme.border} max-w-2xl w-full backdrop-blur-sm`}
        >
          <h1 className="text-2xl font-bold text-white mb-2 text-center">
            Set up your classes
          </h1>
          <p className="text-white/60 mb-6 text-center">
            Enter your class schedule for periods 1 through 8. Drag and drop subjects or click them to fill empty slots.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {subjects.map((subject) => (
              <div
                key={subject}
                draggable
                onDragStart={(e) => handleDragStart(e, subject)}
                onClick={() => handleSubjectClick(subject)}
                className={`px-3 py-1.5 bg-white/10 hover:bg-white/20 border ${currentTheme.border} rounded-lg text-white text-sm cursor-grab active:cursor-grabbing transition-colors`}
              >
                {subject}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {["1", "2", "3A", "3B", "4A", "4B", "5", "6", "7", "8"].map(
              (period) => (
                <div key={period} className="flex items-center gap-3">
                  <div className="w-16 text-right text-white/60 font-mono text-sm">
                    Period {period}
                  </div>
                  <input
                    type="text"
                    value={classes[period] || ""}
                    onChange={(e) =>
                      setClasses({ ...classes, [period]: e.target.value })
                    }
                    onDrop={(e) => handleDrop(e, period)}
                    onDragOver={handleDragOver}
                    className={`flex-1 bg-black/40 border ${currentTheme.border} rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/50 transition-colors`}
                    placeholder="Drag subject here..."
                  />
                </div>
              ),
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className={`flex-1 ${currentTheme.button} ${currentTheme.buttonHover} text-white font-bold py-3 px-4 rounded-xl transition-colors`}
            >
              Next
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${currentTheme.bg} flex items-center justify-center p-4 transition-colors duration-500`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-black/20 p-8 rounded-3xl border ${currentTheme.border} max-w-md w-full text-center backdrop-blur-sm`}
      >
        <h1 className="text-2xl font-bold text-white mb-2">Choose a Style</h1>
        <p className="text-white/60 mb-8">Select a color theme for your app.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {["slate", "indigo", "emerald", "rose", "light", "dark", "whitish", "darkish"].map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`py-4 rounded-xl font-medium capitalize transition-colors border-2 ${theme === t ? "border-white bg-white/20" : "border-transparent bg-black/40 hover:bg-black/60"} text-white`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setStep(2)}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            disabled={loading}
            className={`flex-1 ${currentTheme.button} ${currentTheme.buttonHover} disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-colors`}
          >
            {loading ? "Saving..." : "Complete Setup"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
