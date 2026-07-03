export const POINT_VALUES = {
  approaches: 1,
  appointments: 5,
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

export const REWARD_TIERS = [
  { tier: "none", label: "No Reward", amount: 0, minPercent: 0, maxPercent: 29 },
  { tier: "bronze", label: "Bronze", amount: 100, minPercent: 30, maxPercent: 50 },
  { tier: "silver", label: "Silver", amount: 200, minPercent: 51, maxPercent: 70 },
  { tier: "gold", label: "Gold", amount: 300, minPercent: 71, maxPercent: 149 },
  { tier: "diamond", label: "Diamond", amount: 500, minPercent: 150, maxPercent: null },
];

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
    appointments: safe("appointments") * POINT_VALUES.appointments,
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

export function getRewardTier(productivityPercent, hasDiamondRequirement = true) {
  if (productivityPercent >= 150 && hasDiamondRequirement) return REWARD_TIERS[4];
  if (productivityPercent >= 150 && !hasDiamondRequirement) return { ...REWARD_TIERS[3], lockedDiamond: true };
  if (productivityPercent >= 71) return REWARD_TIERS[3];
  if (productivityPercent >= 51) return REWARD_TIERS[2];
  if (productivityPercent >= 30) return REWARD_TIERS[1];
  return REWARD_TIERS[0];
}

export function getWeekKey(dateString) {
  const date = new Date(dateString + "T00:00:00");
  const first = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - first) / 86400000);
  const week = Math.ceil((days + first.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getMonthKey(dateString) {
  return (dateString || "").slice(0, 7);
}

export function currency(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(value || 0));
}
