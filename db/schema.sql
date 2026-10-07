CREATE TABLE users
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email      text        NOT NULL UNIQUE,
    role       text        NOT NULL CHECK (role IN ('host', 'guest')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listings
(
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id        bigint         NOT NULL REFERENCES users (id),
    title           text           NOT NULL,
    city            text           NOT NULL,
    price_per_night numeric(12, 2) NOT NULL CHECK (price_per_night >= 0),
    created_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE TABLE bookings
(
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id   bigint         NOT NULL REFERENCES listings (id),
    guest_id     bigint         NOT NULL REFERENCES users (id),
    check_in     date           NOT NULL,
    check_out    date           NOT NULL,
    status       text           NOT NULL CHECK (status IN ('requested', 'confirmed', 'cancelled')),
    total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
    created_at   timestamptz    NOT NULL DEFAULT now(),
    CHECK (check_out > check_in)
);

CREATE TABLE reviews
(
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id bigint      NOT NULL UNIQUE REFERENCES bookings (id),
    rating     integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body       text,
    created_at timestamptz NOT NULL DEFAULT now()
);