# PostgreSQL database

The configured local database is `rkr_tour` at `127.0.0.1:55432`, isolated from the pre-existing server on 5432. Credentials are in ignored `../backend/.env`; never copy them into SQL, browser code or documentation.

`schema.sql` creates vehicles, bookings, contact_enquiries, indexes, constraints, relationships and timestamp triggers. Booking references have a unique constraint and use UUID-based generation. New requests default to pending. Booking creation checks and locks the vehicle row inside a transaction before inserting the request. This is not a fleet allocation engine; confirmed status is an authenticated operator action.

`seed.sql` inserts 12 example vehicles only when their name does not already exist. All are samples with unconfirmed availability, and unknown specifications remain NULL. The phrase “18 Seater Luxury” is a requested catalogue label, not verified capacity. Seed data never overwrites configured records.

Apply both files with `npm.cmd run db:init` in backend, or use `psql -h 127.0.0.1 -p 55432 -U rkr_app -d rkr_tour -f database/schema.sql` and then seed.sql from the project root. See the root README for creating roles/databases on an existing server.

Windows helpers:

- `setup-local.ps1`: new local SCRAM-authenticated cluster and random credentials; refuses existing configuration.
- `start-local.ps1`: start only this project's cluster.
- `stop-local.ps1`: stop only this project's cluster.
- Optional `-PostgresBin` selects the installed PostgreSQL binary directory.

Keep production PGDATA outside synced folders. Use PostgreSQL backups (for example pg_dump), verify restoration, separate the schema owner from the application role, and restrict runtime privileges. Do not use development QA deletion scripts on production. Booking and enquiry tables contain personal data; apply a business-approved retention policy.

The current catalogue includes 14 entries. vehicle_tariffs stores the owner-supplied INR package and extra charges keyed by vehicle_id. Apply migrations/002_vehicle_tariffs.sql and seed-tariffs.sql when upgrading; the standard backend db:init command includes both. The tariff seed preserves existing configured rates on subsequent runs. Setting tariff values does not change fleet availability or confirm reservations.
