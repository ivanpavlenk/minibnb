# Restore drill

Date: 2026-09-20

Dump: `backups/minibnb-2026-09-20.dump`  
Size: 18.4 KB (`pg_dump -Fc`)

Live checksum (bookings): `count(*) | sum(total_amount)` = `18|6300000`

Restore target: disposable Postgres container `minibnb-restore-drill` on a fresh volume `minibnb_restore_drill` (created and removed by `scripts/restore-drill.sh`).

Restored checksum: `18|6300000`  
Result: **MATCH**

Wall-clock of one drill (`time bash scripts/restore-drill.sh`): **4.143 seconds** (`real`).

## RTO

**RTO ≈ 5 seconds** (measured 4.143 s on this machine): time to start an empty Postgres, `pg_restore --no-owner`, and confirm the bookings checksum. This is restore of a small course database, not a production multi-GB dump.

## RPO

Backups run **nightly** (`backup.cron`: `0 3 * * *` … `backup.sh`).  
**RPO = up to 24 hours**: work done after last night’s dump can be lost until the next run.
