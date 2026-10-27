import { reminderRequestSchema, scheduleDeadlineReminder } from "./deadline_reminder.js";
import { infrai } from "./infrai_cron.js";

const input = reminderRequestSchema.parse({
  course: {
    courseId: "typescript-201",
    title: "Practical TypeScript",
    deliveryEndsAt: "2030-06-30T17:00:00Z",
  },
  learnerDeadline: {
    learnerId: "learner-42",
    dueAt: "2030-06-28T17:00:00Z",
  },
  educatorReportUrl: "https://school.example.edu/hooks/deadline-report",
});

const result = await scheduleDeadlineReminder(input, infrai.cron.create);
console.log(JSON.stringify(result, null, 2));
