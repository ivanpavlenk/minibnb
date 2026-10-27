CREATE TABLE IF NOT EXISTS health_check (
 id INT PRIMARY KEY,
    note TEXT NOT NULL
);

INSERT INTO health_check (id, note) VALUES (1, 'ok')
    ON CONFLICT (id) DO NOTHING;