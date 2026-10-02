# Trial follow-up operations

Apply migration `0023_trial_followup` before deploying the worker.
Set `TRIAL_FOLLOWUP_START_AT` to the actual rollout UTC timestamp. Without a
valid marker or enabled email configuration, the worker sends nothing.

Schedule an hourly authenticated GET or POST to `/api/cron/trial-followup`,
using the existing cron authorization mechanism. Never enable the campaign
with an old date to recover historical recipients.

Each trial has at most one delivery reservation for each stage: day 1, day 7,
day 30 after trial expiration. Missing a 24-hour window skips that stage.
Reservations survive provider timeouts; automatic retries are disabled to
avoid duplicate emails after an uncertain external outcome.

The route returns `sent`, `skipped`, and `failed` counts. Inspect
`trial_followup_deliveries` for state and accepted provider message IDs;
do not delete failed reservations to retry blindly.

Confirmed unlimited payment stops the sequence even after cancellation.
Email offers opt-out in the profile applies to trial follow-up too.
Tests must use isolated PostgreSQL and a mocked email provider.

Analytics records `trial_offer_seen` once on first persisted impression and
`trial_activated` once after successful activation commit. Existing analytics
consent and runtime token configuration remain authoritative.
