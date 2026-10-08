import { escapeHtml } from "./markdown.js";
export function createWelcomeView({ elements, getPosts, getPostUpdatedDate, visiblePost, getSkillsConfig, getRunId }) {
    const { activityGridEl, activitySummaryEl, skillDiamondEl } = elements;
  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(dateValue) {
    const [year, month, day] = String(dateValue || "").slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) {
      return "";
    }

    return toDateKey(new Date(year, month - 1, day));
  }

  function addDays(date, days) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  function addMonths(date, months) {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
  }

  function getActivityClass(entry) {
    if (!entry.total) {
      return "is-empty";
    }

    const level = Math.min(4, entry.total);
    if (entry.articles && entry.projects) {
      return `activity-level-${level} is-mixed`;
    }

    return `activity-level-${level} ${entry.articles ? "is-article" : "is-project"}`;
  }

  function getActivityLabel(dateKey, entry) {
    if (!entry.total) {
      return `${dateKey} 没有更新`;
    }

    const pieces = [];
    if (entry.articles) {
      pieces.push(`${entry.articles} 篇文章`);
    }
    if (entry.projects) {
      pieces.push(`${entry.projects} 个项目`);
    }

    return `${dateKey} 更新 ${pieces.join("，")}`;
  }

  function renderActivityGrid() {
    if (!activityGridEl || !activitySummaryEl) {
      return;
    }

    const trackedPosts = getPosts().filter((post) => visiblePost(post) && (post.tab === "articles" || post.tab === "projects"));
    const updatesByDate = new Map();

    trackedPosts.forEach((post) => {
      const dateKey = parseDateKey(getPostUpdatedDate(post));
      if (!dateKey) {
        return;
      }

      const entry = updatesByDate.get(dateKey) || { articles: 0, projects: 0, total: 0 };
      if (post.tab === "articles") {
        entry.articles += 1;
      } else {
        entry.projects += 1;
      }
      entry.total += 1;
      updatesByDate.set(dateKey, entry);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixMonthsAgo = addMonths(today, -6);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const startDate = addDays(sixMonthsAgo, -sixMonthsAgo.getDay());
    const endDate = addDays(today, 6 - today.getDay());
    const totalDays = Math.round((endDate - startDate) / 86400000) + 1;
    const weeks = Math.ceil(totalDays / 7);
    const cells = [];
    const monthLabels = [];
    let lastMonth = "";

    for (let dayIndex = 0; dayIndex < weeks * 7; dayIndex += 1) {
      const date = addDays(startDate, dayIndex);
      const dateKey = toDateKey(date);
      const entry = updatesByDate.get(dateKey) || { articles: 0, projects: 0, total: 0 };
      const week = Math.floor(dayIndex / 7) + 1;
      const day = date.getDay() + 1;
      const isOutsideRange = date < sixMonthsAgo || date > today;

      if (day === 1 && date >= startDate && date <= today) {
        const month = `${date.getMonth() + 1}月`;
        if (month !== lastMonth) {
          monthLabels.push(`<span class="activity-month" style="--week: ${week};">${month}</span>`);
          lastMonth = month;
        }
      }

      cells.push(`
        <span
          class="activity-cell ${getActivityClass(entry)} ${isOutsideRange ? "is-outside-range" : ""}"
          style="--week: ${week}; --day: ${day};"
          title="${escapeHtml(getActivityLabel(dateKey, entry))}"
          aria-label="${escapeHtml(getActivityLabel(dateKey, entry))}"
        ></span>
      `);
    }

    const articleUpdates = [...updatesByDate.values()].reduce((total, entry) => total + entry.articles, 0);
    const projectUpdates = [...updatesByDate.values()].reduce((total, entry) => total + entry.projects, 0);
    activitySummaryEl.innerHTML = `
      <span>文章 ${articleUpdates} 次更新</span>
      <span>项目 ${projectUpdates} 次更新</span>
    `;
    activityGridEl.style.setProperty("--weeks", weeks);
    activityGridEl.innerHTML = `
      <div class="activity-months" aria-hidden="true">${monthLabels.join("")}</div>
      <div class="activity-weekdays" aria-hidden="true">
        <span style="--day: 2;">周一</span>
        <span style="--day: 4;">周三</span>
        <span style="--day: 6;">周五</span>
      </div>
      <div class="activity-cells">${cells.join("")}</div>
    `;
  }

  function mapSkillSize(weight, minWeight, maxWeight) {
    const normalized = maxWeight === minWeight ? 0.5 : (weight - minWeight) / (maxWeight - minWeight);
    return 0.76 + Math.max(0, Math.min(1, normalized)) * 1.22;
  }

  function getDiamondPosition(index, total) {
    if (index === 0) {
      return { x: 50, y: 50 };
    }

    const ringIndex = index - 1;
    const ring = Math.floor((Math.sqrt(ringIndex + 1) - 1) / 2) + 1;
    const ringStart = (2 * ring - 1) ** 2 - 1;
    const ringSlots = Math.max(4, ring * 8);
    const slot = (ringIndex - ringStart + ringSlots) % ringSlots;
    const angle = -Math.PI / 2 + (slot / ringSlots) * Math.PI * 2;
    const maxRing = Math.max(1, Math.ceil((Math.sqrt(Math.max(total - 1, 1)) - 1) / 2) + 1);
    const radius = 8 + (ring / maxRing) * 34;
    const diamondScale = 1 / (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)));

    return {
      x: 50 + Math.cos(angle) * radius * diamondScale,
      y: 50 + Math.sin(angle) * radius * diamondScale
    };
  }

  async function renderSkillDiamond(expectedRunId = getRunId()) {
    if (!skillDiamondEl) {
      return;
    }

    const config = await getSkillsConfig();
    if (expectedRunId !== getRunId()) {
      return;
    }

    const skills = [...(config.skills || [])].sort((a, b) => (b.weight || 1) - (a.weight || 1));
    const minWeight = config.weightRange?.min ?? Math.min(...skills.map((skill) => skill.weight || 1), 1);
    const maxWeight = config.weightRange?.max ?? Math.max(...skills.map((skill) => skill.weight || 1), 10);

    skillDiamondEl.innerHTML = skills.map((skill, index) => {
      const position = getDiamondPosition(index, skills.length);
      const size = mapSkillSize(skill.weight || minWeight, minWeight, maxWeight);
      return `
        <span class="skill-token" style="--x: ${position.x}%; --y: ${position.y}%; --skill-size: ${size}rem;">
          ${escapeHtml(skill.label)}
        </span>
      `;
    }).join("");
  }

  return { renderActivityGrid, renderSkillDiamond };
}
