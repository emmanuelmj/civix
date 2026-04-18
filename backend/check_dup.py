import asyncio, asyncpg
async def f():
    c = await asyncpg.connect('postgresql://civix:civix_dev@localhost:5432/civix_pulse')
    rows = await c.fetch("SELECT translated_description, COUNT(*) as cnt FROM pulse_events GROUP BY translated_description HAVING COUNT(*) > 1 ORDER BY cnt DESC LIMIT 5")
    for r in rows:
        print(f"  count={r['cnt']}  desc={r['translated_description'][:60]}")
    if not rows:
        print("No duplicates found")
    await c.close()
asyncio.run(f())
