import { DataSource } from 'typeorm';

export async function ensureListingOne(ds: DataSource): Promise<void> {
    await ds.query(
        `INSERT INTO users (email, role, balance_cents)
         VALUES ('pact.host@minibnb.test', 'host', 0)
         ON CONFLICT (email) DO NOTHING`,
    );
    await ds.query(
        `INSERT INTO listings (id, owner_id, title, city, price_per_night, stock)
         SELECT 1, u.id, 'Квартира на Подоле', 'Kyiv', 260000, 1
         FROM users u
         WHERE u.email = 'pact.host@minibnb.test'
         ON CONFLICT (id) DO NOTHING`,
    );
    await ds.query(
        `SELECT setval(
            pg_get_serial_sequence('listings', 'id'),
            (SELECT COALESCE(MAX(id), 1) FROM listings)
         )`,
    );
}
