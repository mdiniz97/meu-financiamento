import { sql, type SQL } from 'drizzle-orm';

/** A stable, opaque per-signup ID; old accounts and dev users stay unmarked. */
export function adsSignupConversionValue(): SQL<string> | undefined {
  return process.env.NODE_ENV === 'production'
    ? sql<string>`'TID_' || nextval('ads_signup_conversion_seq')::text`
    : undefined;
}
