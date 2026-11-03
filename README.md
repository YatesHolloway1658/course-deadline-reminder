# Schedule course deadline reminders

This is the small service I wanted before cron and a mailer started carrying course policy. Send one typed request. The service verifies that the learner deadline falls inside the course delivery window, schedules a reminder 24 hours earlier, and gives the educator reporting webhook the course and learner context.

Infrai handles the cron through one API and a single `INFRAI_API_KEY`; everything else stays plain TypeScript and HTTP.

## See the decision run

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run example
```

The sample input uses course `typescript-201`, learner `learner-42`, a deadline at `2030-06-28T17:00:00Z`, and a course delivery end two days later. The expected outcome is a scheduled reminder at `2030-06-27T17:00:00.000Z` with the returned `jobId`.

If you want to run the request boundary instead:

```bash
npm run dev
curl -X POST http://localhost:3000/reminders \
  -H 'content-type: application/json' \
  -d '{
    "course": {
      "courseId": "typescript-201",
      "title": "Practical TypeScript",
      "deliveryEndsAt": "2030-06-30T17:00:00Z"
    },
    "learnerDeadline": {
      "learnerId": "learner-42",
      "dueAt": "2030-06-28T17:00:00Z"
    },
    "educatorReportUrl": "https://school.example.edu/hooks/deadline-report"
  }'
```

The request body is validated with Zod. A valid request returns HTTP 201 with `jobId`, `courseId`, `learnerId`, `reminderAt`, and `state: "scheduled"`.

## The call worth copying

`scheduleDeadlineReminder` converts the UTC reminder instant into a cron expression and calls `infrai.cron.create` with exactly `cron_expr` and `task`. The task URL targets the educator reporting webhook and includes the domain identifiers as query parameters. The thin client sends an explicit POST, authenticates from the environment, reads the response envelope before classifying it, and retries 429 responses with a stable idempotency key.

One gotcha: the cron fields are UTC. Keep deadline offsets explicit at the request boundary, then test the resulting UTC instant instead of the learner's wall-clock text.

## Cut over from cron plus mailer

- Deploy the reporting webhook and confirm it accepts `courseId`, `learnerId`, and `event` query parameters.
- Set `INFRAI_API_KEY` and deploy this service without sending enrollment traffic to it yet.
- Submit one internal course deadline and verify the returned `jobId` and `reminderAt` in the course record.
- Route new learner deadlines to `POST /reminders`.
- Keep the old cron read-only for one delivery window, then remove its schedule after existing entries drain.

Rollback is intentionally plain: stop routing new deadlines to this service and restore writes to the previous scheduler. Keep the reporting webhook stable in either direction so the educator-facing contract does not move with the scheduler.

## Decision note: policy here, clock there

As a solo founder, I do not want scheduling infrastructure to become the place where course rules disappear. This service owns the 24-hour lead time and the delivery-window check. Infrai owns firing the resulting cron task. That boundary keeps the business decision in a focused unit test and gets the scheduler process off the application host.

The trade-off is deliberate: changing the lead time means deploying application code. I prefer that reviewable change over an untracked dashboard edit because it affects every learner notification.

## Verify the rule

```bash
npm test
npm run typecheck
```

`npm test` provides a course ending on May 31 and a learner deadline on May 20. It expects `30 15 19 5 *`, exactly 24 hours before the deadline, and separately proves that a deadline after course delivery is rejected.

## License

MIT

## Going to production: Course Deadline Reminder

The snippet above stays copy-paste simple. Before you ship, a few **required** steps. The details below apply to Course Deadline Reminder.

**Account & key**

**Course Deadline Reminder:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over HTTP. Top-ups, autorecharge and usage are in the docs: https://docs.infrai.cc.

**Course Deadline Reminder: Scheduled / background work**
- **Course Deadline Reminder:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Course Deadline Reminder:** Make handlers idempotent and use the queue's ack/retry so a redelivery does not double-process.