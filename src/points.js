export const POINT_VALUES = {
  approaches: 1,
  clientAppointments: 5,
  bybInvites: 5,
  presentation: 20,
  bybTableTop: 20,
  closedCases: 200,
  recruitment: 0,
  meetTheManager: 50,
  paidExam: 50,
  coded: 100,
  branding: 1,
  training: 5,
  teamEngagement: 1,
};

export const BRANDING_MAX_PER_DAY = 3;
export const WEEKLY_TARGET = 500;

export const COMPETITION_START_DATE = "2026-07-03";

function toLocalDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDateLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getCompetitionWeek(dateString) {
  const current = toLocalDate(dateString || new Date().toISOString().slice(0, 10));
  const launch = toLocalDate(COMPETITION_START_DATE);

  if (current < launch) {
    return {
      key: "pre-launch",
      number: 0,
      label: "Pre-Launch",
      startDate: "",
      endDate: "",
      dateRange: "Before Jul 3, 2026",
    };
  }

  const firstWeekEnd = toLocalDate("2026-07-05");
  if (current <= firstWeekEnd) {
    return {
      key: "week-1",
      number: 1,
      label: "Week 1",
      startDate: "2026-07-03",
      endDate: "2026-07-05",
      dateRange: "Jul 3 – Jul 5, 2026",
    };
  }

  // Week 2 starts Monday, July 6, 2026. After that, weeks run Monday to Sunday.
  const week2Start = toLocalDate("2026-07-06");
  const diffDays = Math.floor((current - week2Start) / 86400000);
  const weekIndex = Math.floor(diffDays / 7);
  const weekNumber = 2 + weekIndex;

  const start = new Date(week2Start);
  start.setDate(week2Start.getDate() + weekIndex * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  return {
    key: `week-${weekNumber}`,
    number: weekNumber,
    label: `Week ${weekNumber}`,
    startDate: startIso,
    endDate: endIso,
    dateRange: `${formatDateLabel(start)} – ${formatDateLabel(end)}`,
  };
}

export function isDateInCompetitionWeek(dateString, weekKey) {
  return getCompetitionWeek(dateString).key === weekKey;
}


export const WEEKLY_LEVELS = [
  { tier: "none", label: "No Level", amount: 0, minPoints: 0, maxPoints: 299 },
  { tier: "bronze", label: "Bronze", amount: 100, minPoints: 300, maxPoints: 499 },
  { tier: "silver", label: "Silver", amount: 200, minPoints: 500, maxPoints: 999 },
  { tier: "gold", label: "Gold", amount: 300, minPoints: 1000, maxPoints: 1499 },
  { tier: "diamond", label: "Diamond", amount: 500, minPoints: 1500, maxPoints: null },
];

export const REWARD_TIERS = WEEKLY_LEVELS;

export function getClosedCaseBonus(apeAmount) {
  const ape = Number(apeAmount || 0);
  if (ape >= 80000) return 300;
  if (ape >= 40000) return 200;
  return ape > 0 ? 100 : 0;
}

export function getPaidExamBonus(examType) {
  if (examType === "dual") return 300;
  if (examType === "single") return 200;
  return 0;
}

export function calculatePoints(data) {
  const safe = (key) => Number(data[key] || 0);
  const brandingCounted = Math.min(safe("branding"), BRANDING_MAX_PER_DAY);

  const breakdown = {
    approaches: safe("approaches") * POINT_VALUES.approaches,
    clientAppointments: safe("clientAppointments") * POINT_VALUES.clientAppointments,
    bybInvites: safe("bybInvites") * POINT_VALUES.bybInvites,
    presentation: safe("presentation") * POINT_VALUES.presentation,
    bybTableTop: safe("bybTableTop") * POINT_VALUES.bybTableTop,
    closedCases: safe("closedCases") * POINT_VALUES.closedCases,
    meetTheManager: safe("meetTheManager") * POINT_VALUES.meetTheManager,
    paidExam: safe("paidExam") * POINT_VALUES.paidExam,
    coded: safe("coded") * POINT_VALUES.coded,
    branding: brandingCounted * POINT_VALUES.branding,
    training: safe("training") * POINT_VALUES.training,
    teamEngagement: safe("teamEngagement") * POINT_VALUES.teamEngagement,
    recruitment: 0,
  };

  return {
    breakdown,
    brandingCounted,
    total: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
  };
}

export function calculateBonuses(data) {
  const closings = data.closingDetails || [];
  const exams = data.examDetails || [];
  const closingBonus = closings.reduce((sum, item) => sum + getClosedCaseBonus(item.apeAmount), 0);
  const examBonus = exams.reduce((sum, item) => sum + getPaidExamBonus(item.type), 0);
  return { closingBonus, examBonus, totalBonus: closingBonus + examBonus };
}

export function getProductivity(weeklyPoints) {
  return (Number(weeklyPoints || 0) / WEEKLY_TARGET) * 100;
}

export function getRewardTier(weeklyPoints, hasDiamondRequirement = true) {
  const points = Number(weeklyPoints || 0);

  if (points >= 1500 && hasDiamondRequirement) return WEEKLY_LEVELS[4];
  if (points >= 1500 && !hasDiamondRequirement) return { ...WEEKLY_LEVELS[3], lockedDiamond: true };
  if (points >= 1000) return WEEKLY_LEVELS[3];
  if (points >= 500) return WEEKLY_LEVELS[2];
  if (points >= 300) return WEEKLY_LEVELS[1];
  return WEEKLY_LEVELS[0];
}

export function getNextLevelProgress(weeklyPoints) {
  const points = Number(weeklyPoints || 0);
  if (points >= 1500) return { current: points, target: 1500, percent: 100, label: "Diamond reached" };
  if (points >= 1000) return { current: points, target: 1500, percent: (points / 1500) * 100, label: "Next: Diamond at 1,500 pts" };
  if (points >= 500) return { current: points, target: 1000, percent: (points / 1000) * 100, label: "Next: Gold at 1,000 pts" };
  if (points >= 300) return { current: points, target: 500, percent: (points / 500) * 100, label: "Next: Silver at 500 pts" };
  return { current: points, target: 300, percent: (points / 300) * 100, label: "Next: Bronze at 300 pts" };
}

export function getWeekKey(dateString) {
  return getCompetitionWeek(dateString).key;
}

export function getMonthKey(dateString) {
  return (dateString || "").slice(0, 7);
}

export function currency(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
}


export function getLevelFromPoints(weeklyPoints, hasDiamondRequirement = true) {
  return getRewardTier(weeklyPoints, hasDiamondRequirement);
}

export function getNextLevelInfo(weeklyPoints, hasDiamondRequirement = true) {
  const points = Number(weeklyPoints || 0);

  if (points >= 1500 && hasDiamondRequirement) {
    return { label: "Diamond qualified", needed: 0, nextLabel: "Diamond", target: 1500, percent: 100 };
  }
  if (points >= 1500 && !hasDiamondRequirement) {
    return { label: "Diamond locked: needs closing or converted recruit", needed: 0, nextLabel: "Diamond Locked", target: 1500, percent: 100 };
  }
  if (points >= 1000) {
    return { label: `${1500 - points} pts to Diamond`, needed: 1500 - points, nextLabel: "Diamond", target: 1500, percent: (points / 1500) * 100 };
  }
  if (points >= 500) {
    return { label: `${1000 - points} pts to Gold`, needed: 1000 - points, nextLabel: "Gold", target: 1000, percent: (points / 1000) * 100 };
  }
  if (points >= 300) {
    return { label: `${500 - points} pts to Silver`, needed: 500 - points, nextLabel: "Silver", target: 500, percent: (points / 500) * 100 };
  }
  return { label: `${300 - points} pts to Bronze`, needed: 300 - points, nextLabel: "Bronze", target: 300, percent: (points / 300) * 100 };
}
