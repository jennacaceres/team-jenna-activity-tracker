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
  { tier: "none", label: "No Reward", amount: 0, color: "#6b7280", minPercent: 0, maxPercent: 30 },
  { tier: "bronze", label: "Bronze", amount: 100, color: "#cd7f32", minPercent: 30, maxPercent: 50 },
  { tier: "silver", label: "Silver", amount: 200, color: "#c0c0c0", minPercent: 51, maxPercent: 70 },
  { tier: "gold", label: "Gold", amount: 300, color: "#D4AF37", minPercent: 71, maxPercent: 150 },
  { tier: "diamond", label: "Diamond", amount: 500, color: "#b9f2ff", minPercent: 150, maxPercent: null },
];

export function calculatePoints(data = {}) {
  const branding = Math.min(Number(data.branding || 0), BRANDING_MAX_PER_DAY);
  const breakdown = {
    approaches: Number(data.approaches || 0) * POINT_VALUES.approaches,
    appointments: Number(data.appointments || 0) * POINT_VALUES.appointments,
    presentation: Number(data.presentation || 0) * POINT_VALUES.presentation,
    bybTableTop: Number(data.bybTableTop || 0) * POINT_VALUES.bybTableTop,
    closedCases: Number(data.closedCases || 0) * POINT_VALUES.closedCases,
    meetTheManager: Number(data.meetTheManager || 0) * POINT_VALUES.meetTheManager,
    paidExam: Number(data.paidExam || 0) * POINT_VALUES.paidExam,
    coded: Number(data.coded || 0) * POINT_VALUES.coded,
    branding: branding * POINT_VALUES.branding,
    training: Number(data.training || 0) * POINT_VALUES.training,
    teamEngagement: Number(data.teamEngagement || 0) * POINT_VALUES.teamEngagement,
  };
  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { breakdown, total };
}

export function getProductivity(points) {
  return (Number(points || 0) / WEEKLY_TARGET) * 100;
}

export function getRewardTier(productivityPercent) {
  if (productivityPercent >= 150) return REWARD_TIERS[4];
  if (productivityPercent >= 71) return REWARD_TIERS[3];
  if (productivityPercent >= 51) return REWARD_TIERS[2];
  if (productivityPercent >= 30) return REWARD_TIERS[1];
  return REWARD_TIERS[0];
}

export function getClosedCaseBonus(apeAmount) {
  const ape = Number(apeAmount || 0);
  if (ape >= 80000) return 300;
  if (ape >= 40000) return 200;
  return ape > 0 ? 100 : 0;
}

export function getPaidExamBonus(examType) {
  if (!examType) return 0;
  return examType === "dual" ? 300 : 200;
}
