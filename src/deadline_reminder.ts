import { z } from "zod";
import type { CronCreateInput } from "./infrai_cron.js";

export const reminderRequestSchema = z.object({
  course: z.object({
    courseId: z.string().min(1),
    title: z.string().min(1),
    deliveryEndsAt: z.string().datetime({ offset: true }),
  }),
  learnerDeadline: z.object({
    learnerId: z.string().min(1),
    dueAt: z.string().datetime({ offset: true }),
  }),
  educatorReportUrl: z.string().url(),
});

export type ReminderRequest = z.infer<typeof reminderRequestSchema>;

export type ReminderRegistration = {
  jobId: string;
  courseId: string;
  learnerId: string;
  reminderAt: string;
  state: "scheduled";
};

export type CronScheduler = (input: CronCreateInput) => Promise<{ job_id: string }>;

export function reminderMoment(request: ReminderRequest): Date {
  const dueAt = new Date(request.learnerDeadline.dueAt);
  const deliveryEndsAt = new Date(request.course.deliveryEndsAt);
  if (dueAt > deliveryEndsAt) {
    throw new RangeError("Learner deadline must fall within course delivery");
  }

  return new Date(dueAt.getTime() - 24 * 60 * 60 * 1_000);
}

function cronExpression(at: Date): string {
  return [
    at.getUTCMinutes(),
    at.getUTCHours(),
    at.getUTCDate(),
    at.getUTCMonth() + 1,
    "*",
  ].join(" ");
}

function reportingTask(request: ReminderRequest): string {
  const task = new URL(request.educatorReportUrl);
  task.searchParams.set("courseId", request.course.courseId);
  task.searchParams.set("learnerId", request.learnerDeadline.learnerId);
  task.searchParams.set("event", "deadline-reminder");
  return task.toString();
}

export async function scheduleDeadlineReminder(
  request: ReminderRequest,
  createCron: CronScheduler,
): Promise<ReminderRegistration> {
  const reminderAt = reminderMoment(request);
  if (reminderAt <= new Date()) {
    throw new RangeError("Reminder time must be in the future");
  }

  const created = await createCron({
    cron_expr: cronExpression(reminderAt),
    task: reportingTask(request),
  });

  return {
    jobId: created.job_id,
    courseId: request.course.courseId,
    learnerId: request.learnerDeadline.learnerId,
    reminderAt: reminderAt.toISOString(),
    state: "scheduled",
  };
}
