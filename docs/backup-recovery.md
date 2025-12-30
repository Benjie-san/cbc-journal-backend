Backup and Recovery (MongoDB Atlas)

Backups
- In Atlas, enable Continuous Backups (PITR) for the production cluster.
- Set snapshot schedule (daily) and keep at least 7-30 days.
- Verify the backup status shows "Enabled".

Recovery Plan (simple)
1) Create a new cluster or run a Point-in-Time restore in Atlas.
2) Update MONGODB_URI in Render to point to the restored cluster.
3) Restart the Render service.
4) Run `npm run db:indexes` once to ensure indexes are built.
5) Smoke test: GET / (root) and log in from the app.
