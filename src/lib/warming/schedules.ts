import { ScheduleType } from "@prisma/client";
import { WARMING_SCHEDULES } from "../constants";
import { prisma } from "../prisma";

export function getSchedulePreset(type: ScheduleType) {
  return WARMING_SCHEDULES[type];
}

export function getScheduleLength(type: ScheduleType): number {
  return WARMING_SCHEDULES[type].length;
}

export async function populateScheduleConfig(
  domainId: string,
  scheduleType: ScheduleType
): Promise<void> {
  // Clear existing config
  await prisma.warmingScheduleConfig.deleteMany({ where: { domainId } });

  const preset = getSchedulePreset(scheduleType);

  // Batch create all day configs
  await prisma.warmingScheduleConfig.createMany({
    data: preset.map((entry) => ({
      domainId,
      day: entry.day,
      targetVolume: entry.volume,
    })),
  });
}

export async function getDayTarget(
  domainId: string,
  day: number
): Promise<number> {
  const config = await prisma.warmingScheduleConfig.findUnique({
    where: { domainId_day: { domainId, day } },
  });
  return config?.targetVolume ?? 0;
}
