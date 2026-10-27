import assert from "node:assert/strict";
import test from "node:test";
import { scheduleDeadlineReminder } from "../src/deadline_reminder.js";

test("schedules the reminder 24 hours before a deadline inside course delivery", async () => {
  let sent: { cron_expr: string; task: string } | undefined;
  const result = await scheduleDeadlineReminder(
    {
      course: {
        courseId: "course-7",
        title: "Algebra II",
        deliveryEndsAt: "2030-05-31T18:00:00Z",
      },
      learnerDeadline: {
        learnerId: "learner-9",
        dueAt: "2030-05-20T15:30:00Z",
      },
      educatorReportUrl: "https://school.example.edu/report",
    },
    async (input) => {
      sent = input;
      return { job_id: "job-123" };
    },
  );

  assert.deepEqual(sent && { ...sent, task: new URL(sent.task).origin + new URL(sent.task).pathname }, {
    cron_expr: "30 15 19 5 *",
    task: "https://school.example.edu/report",
  });
  assert.equal(result.reminderAt, "2030-05-19T15:30:00.000Z");
  assert.equal(result.state, "scheduled");
});

test("rejects a learner deadline after course delivery", async () => {
  await assert.rejects(
    scheduleDeadlineReminder(
      {
        course: {
          courseId: "course-7",
          title: "Algebra II",
          deliveryEndsAt: "2030-05-20T18:00:00Z",
        },
        learnerDeadline: {
          learnerId: "learner-9",
          dueAt: "2030-05-21T15:30:00Z",
        },
        educatorReportUrl: "https://school.example.edu/report",
      },
      async () => ({ job_id: "unused" }),
    ),
    /within course delivery/,
  );
});
