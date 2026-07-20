export type LearnLevel = { key: string; title: string; sub?: string; href: string };
export type LearnTrack = {
  id: string;
  title: string;
  blurb: string;
  sourceLabel: string;
  sourceUrl: string;
  gradient: [string, string];
  levels: LearnLevel[];
};

const PY = "https://github.com/Asabeneh/30-Days-Of-Python";
// Folder-slug confirmed for Day 1 only ("01_Day_Introduction"); the rest
// route to the repo root so nothing links to a guessed path -- the README's
// own table of contents takes it from there.
const PYTHON_DAYS: [string, string][] = [
  ["Introduction", `${PY}/tree/master/01_Day_Introduction`],
  ["Variables, built-in functions", PY],
  ["Operators", PY],
  ["Strings", PY],
  ["Lists", PY],
  ["Tuples", PY],
  ["Sets", PY],
  ["Dictionaries", PY],
  ["Conditionals", PY],
  ["Loops", PY],
  ["Functions", PY],
  ["Modules", PY],
  ["List comprehension", PY],
  ["Higher order functions", PY],
  ["Python type errors", PY],
  ["Python datetime", PY],
  ["Exception handling", PY],
  ["Regular expressions", PY],
  ["File handling", PY],
  ["Python package manager", PY],
  ["Classes and objects", PY],
  ["Web scraping", PY],
  ["Virtual environment", PY],
  ["Statistics", PY],
  ["Pandas", PY],
  ["Python web (Flask)", PY],
  ["Python with MongoDB", PY],
  ["API", PY],
  ["Building an API", PY],
  ["Conclusion", PY],
];

const CYBER = "https://github.com/farhanashrafdev/90DaysOfCyberSecurity";
// Repacked from the real 90-day plan's day-ranges into 11 levels -- a pace
// that fits around swim training better than literally 90 sequential days.
const CYBER_LEVELS: [string, string][] = [
  ["Network+ fundamentals", "Days 1–7 of the source plan"],
  ["Security+ principles", "Days 8–14"],
  ["Linux", "Days 15–28"],
  ["Python for security", "Days 29–42"],
  ["Traffic analysis (Wireshark/tcpdump)", "Days 43–56"],
  ["Git", "Days 57–63"],
  ["ELK stack / SIEM", "Days 64–70"],
  ["Cloud security (AWS/GCP/Azure)", "Days 71–77"],
  ["Ethical hacking labs", "Days 85–90"],
  ["Resume", "Days 91–92"],
  ["Job search", "Days 93–95"],
];

export const LEARN_TRACKS: LearnTrack[] = [
  {
    id: "python",
    title: "30 Days of Python",
    blurb: "Asabeneh's step-by-step Python challenge -- 30 days, real exercises, go at your own pace.",
    sourceLabel: "Asabeneh/30-Days-Of-Python",
    sourceUrl: PY,
    gradient: ["#c4b5fd", "#5ac8fa"],
    levels: PYTHON_DAYS.map(([title], i) => ({
      key: `day-${String(i + 1).padStart(2, "0")}`,
      title: `Day ${i + 1}`,
      sub: title,
      href: PYTHON_DAYS[i][1],
    })),
  },
  {
    id: "ml",
    title: "ML for Beginners",
    blurb: "Microsoft's classic-ML curriculum -- 12 weeks, 26 lessons, hands-on projects with scikit-learn.",
    sourceLabel: "microsoft/ML-For-Beginners",
    sourceUrl: "https://github.com/microsoft/ML-For-Beginners",
    gradient: ["#5ac8fa", "#0a84ff"],
    levels: [
      { key: "intro", title: "Level 1", sub: "Introduction to ML", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "regression", title: "Level 2", sub: "Regression", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "webapp", title: "Level 3", sub: "Web app -- ship a trained model", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "classification", title: "Level 4", sub: "Classification", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "clustering", title: "Level 5", sub: "Clustering", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "nlp", title: "Level 6", sub: "Natural language processing", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "timeseries", title: "Level 7", sub: "Time series forecasting", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "rl", title: "Level 8", sub: "Reinforcement learning", href: "https://github.com/microsoft/ML-For-Beginners" },
      { key: "realworld", title: "Level 9", sub: "Real-world ML", href: "https://github.com/microsoft/ML-For-Beginners" },
    ],
  },
  {
    id: "byox",
    title: "Build Your Own X",
    blurb: "Recreate the tools you use every day, from scratch -- pick a category, follow the guide.",
    sourceLabel: "codecrafters-io/build-your-own-x",
    sourceUrl: "https://github.com/codecrafters-io/build-your-own-x",
    gradient: ["#fde68a", "#ff9f0a"],
    levels: [
      { key: "shell", title: "Level 1", sub: "Build your own Shell", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-shell" },
      { key: "git", title: "Level 1", sub: "Build your own Git", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-git" },
      { key: "regex", title: "Level 1", sub: "Build your own Regex Engine", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-regex-engine" },
      { key: "docker", title: "Level 2", sub: "Build your own Docker", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-docker" },
      { key: "database", title: "Level 2", sub: "Build your own Database", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-database" },
      { key: "webserver", title: "Level 2", sub: "Build your own Web Server", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-web-server" },
      { key: "proglang", title: "Level 3", sub: "Build your own Programming Language", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-programming-language" },
      { key: "neuralnet", title: "Level 3", sub: "Build your own Neural Network", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-neural-network" },
      { key: "os", title: "Level 3", sub: "Build your own Operating System", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-operating-system" },
      { key: "renderer3d", title: "Level 4", sub: "Build your own 3D Renderer", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-3d-renderer" },
      { key: "blockchain", title: "Level 4", sub: "Build your own Blockchain / Cryptocurrency", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-blockchaincryptocurrency" },
      { key: "physics", title: "Level 4", sub: "Build your own Physics Engine", href: "https://github.com/codecrafters-io/build-your-own-x#build-your-own-physics-engine" },
    ],
  },
  {
    id: "pbl",
    title: "Project-Based Learning",
    blurb: "273k-star curated list -- build real applications from scratch, organized by language.",
    sourceLabel: "practical-tutorials/project-based-learning",
    sourceUrl: "https://github.com/practical-tutorials/project-based-learning",
    gradient: ["#30d158", "#66d4cf"],
    levels: [
      { key: "python", title: "Level 1", sub: "Python", href: "https://github.com/practical-tutorials/project-based-learning#python" },
      { key: "js", title: "Level 1", sub: "JavaScript", href: "https://github.com/practical-tutorials/project-based-learning#javascript" },
      { key: "htmlcss", title: "Level 1", sub: "HTML / CSS", href: "https://github.com/practical-tutorials/project-based-learning#htmlcss" },
      { key: "go", title: "Level 2", sub: "Go", href: "https://github.com/practical-tutorials/project-based-learning#go" },
      { key: "java", title: "Level 2", sub: "Java", href: "https://github.com/practical-tutorials/project-based-learning#java" },
      { key: "csharp", title: "Level 2", sub: "C#", href: "https://github.com/practical-tutorials/project-based-learning#c-1" },
      { key: "c", title: "Level 3", sub: "C / C++", href: "https://github.com/practical-tutorials/project-based-learning#cc" },
      { key: "rust", title: "Level 3", sub: "Rust", href: "https://github.com/practical-tutorials/project-based-learning#rust" },
      { key: "haskell", title: "Level 4", sub: "Haskell", href: "https://github.com/practical-tutorials/project-based-learning#haskell" },
      { key: "erlang", title: "Level 4", sub: "Erlang / Elixir", href: "https://github.com/practical-tutorials/project-based-learning#erlangelixir" },
    ],
  },
  {
    id: "cyber",
    title: "Cybersecurity",
    blurb: "Repacked from a real 90-day study plan into 11 levels -- Network+, Security+, Linux, and up through ethical hacking.",
    sourceLabel: "farhanashrafdev/90DaysOfCyberSecurity",
    sourceUrl: CYBER,
    gradient: ["#ff453a", "#bf5af2"],
    levels: CYBER_LEVELS.map(([title, sub], i) => ({
      key: `phase-${i + 1}`,
      title: `Level ${i + 1}`,
      sub: `${title} — ${sub}`,
      href: CYBER,
    })),
  },
];

export function findTrack(id: string): LearnTrack | undefined {
  return LEARN_TRACKS.find((t) => t.id === id);
}
